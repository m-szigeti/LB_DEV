"""Apply composite scoring to theme CSV files (T2-T4 and T6-T8)."""

from __future__ import annotations

import shutil
from pathlib import Path

import pandas as pd

from composite_index_score import (
    build_pipeline_export,
    detect_columns,
    score_dataframe,
)
from config import (
    COMPOSITE_THEMES,
    LEVELS,
    SKIP_COMPOSITE_THEMES,
    composite_csv_dir,
    parse_theme_number,
    raw_csv_dir,
    reports_dir,
)
from io_utils import read_csv_flexible, write_csv_unicode
from pipeline_sources import prune_stale_composite_outputs, raw_theme_csv_paths


def _theme_from_filename(path: Path) -> int | None:
    return parse_theme_number(None, path.stem)


def process_csv_file(csv_path: Path, level: str) -> dict:
    theme = _theme_from_filename(csv_path)
    output_path = composite_csv_dir(level) / csv_path.name
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if theme in SKIP_COMPOSITE_THEMES or theme not in COMPOSITE_THEMES:
        shutil.copy2(csv_path, output_path)
        action = "copied_unchanged"
        print(f"[T{theme}] Copied without scoring: {csv_path.name}")
        return {
            "source_csv": csv_path.name,
            "level": level,
            "theme": theme,
            "action": action,
            "output_csv": output_path.name,
        }

    df = read_csv_flexible(csv_path)
    col_dist, keep_id_cols, indicator_cols = detect_columns(df)
    scored_df, weights_df, kendall_df, indicator_cols = score_dataframe(df)
    export_df = build_pipeline_export(
        scored_df, col_dist, keep_id_cols, indicator_cols, level
    )
    write_csv_unicode(export_df, output_path, index=False)

    weights_path = composite_csv_dir(level) / f"{csv_path.stem}_Weights.csv"
    kendall_path = composite_csv_dir(level) / f"{csv_path.stem}_Kendall_Matrix.csv"
    write_csv_unicode(weights_df, weights_path, index=False)
    write_csv_unicode(kendall_df, kendall_path, index=True)

    print(f"[T{theme}] Scored: {csv_path.name} -> {output_path.name}")
    return {
        "source_csv": csv_path.name,
        "level": level,
        "theme": theme,
        "action": "composite_scored",
        "output_csv": output_path.name,
        "indicator_count": len(indicator_cols),
    }


def run_composite_scoring(levels: tuple[str, ...] = LEVELS) -> list[dict]:
    records: list[dict] = []
    for level in levels:
        csv_files = raw_theme_csv_paths(level)
        if not csv_files:
            print(f"No source CSV files in {raw_csv_dir(level)}")
            continue
        active_names: set[str] = set()
        for csv_path in csv_files:
            try:
                records.append(process_csv_file(csv_path, level))
                active_names.add(csv_path.name)
            except ValueError as exc:
                print(f"Skipped {csv_path.name}: {exc}")
                records.append({
                    "source_csv": csv_path.name,
                    "level": level,
                    "theme": _theme_from_filename(csv_path),
                    "action": "error",
                    "error": str(exc),
                })

        removed = prune_stale_composite_outputs(level, active_names)
        if removed:
            print(f"[{level}] Removed {len(removed)} stale CSV_COMPOSITE file(s)")

    if records:
        report_path = reports_dir() / "composite_scoring_log.csv"
        report_path.parent.mkdir(parents=True, exist_ok=True)
        write_csv_unicode(pd.DataFrame(records), report_path, index=False)
        print(f"Wrote scoring log: {report_path}")

    return records


if __name__ == "__main__":
    run_composite_scoring()
