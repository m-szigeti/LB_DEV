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
from custom_weights import (
    WEIGHT_MODE_CUSTOM,
    WEIGHT_MODE_KENDALL,
    CustomWeightCatalog,
    load_custom_weight_catalog,
)
from io_utils import read_csv_flexible, write_csv_unicode
from pipeline_sources import prune_stale_composite_outputs, raw_theme_csv_paths


def _theme_from_filename(path: Path) -> int | None:
    return parse_theme_number(None, path.stem)


def process_csv_file(
    csv_path: Path,
    level: str,
    catalog: CustomWeightCatalog | None = None,
    weight_mode: str = WEIGHT_MODE_KENDALL,
) -> dict:
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
            "weight_mode": weight_mode,
        }

    df = read_csv_flexible(csv_path)
    col_dist, keep_id_cols, indicator_cols = detect_columns(df)

    custom_weights = None
    custom_source = ""
    if weight_mode == WEIGHT_MODE_CUSTOM and catalog is not None:
        weight_set = catalog.get(level, theme)
        if weight_set is not None:
            custom_weights = weight_set.weights
            custom_source = weight_set.source_path.name
            print(
                f"[T{theme}] Using custom weights from {custom_source} "
                f"({len(custom_weights)} indicators)"
            )
        else:
            print(
                f"[T{theme}] No custom weight CSV for {level}; "
                "using Kendall weights for this theme."
            )

    scored_df, weights_df, kendall_df, indicator_cols = score_dataframe(
        df, custom_weights=custom_weights
    )
    export_df = build_pipeline_export(
        scored_df, col_dist, keep_id_cols, indicator_cols, level
    )
    write_csv_unicode(export_df, output_path, index=False)

    weights_path = composite_csv_dir(level) / f"{csv_path.stem}_Weights.csv"
    kendall_path = composite_csv_dir(level) / f"{csv_path.stem}_Kendall_Matrix.csv"
    write_csv_unicode(weights_df, weights_path, index=False)
    write_csv_unicode(kendall_df, kendall_path, index=True)

    used_custom = bool(
        custom_weights
        and "Weight_Source" in weights_df.columns
        and (weights_df["Weight_Source"] == "custom").any()
    )
    print(f"[T{theme}] Scored: {csv_path.name} -> {output_path.name}")
    return {
        "source_csv": csv_path.name,
        "level": level,
        "theme": theme,
        "action": "composite_scored_custom" if used_custom else "composite_scored",
        "output_csv": output_path.name,
        "indicator_count": len(indicator_cols),
        "weight_mode": "custom" if used_custom else "kendall",
        "custom_weights_file": custom_source if used_custom else "",
    }


def run_composite_scoring(
    levels: tuple[str, ...] = LEVELS,
    weight_mode: str = WEIGHT_MODE_KENDALL,
    custom_weights_dir: str | Path | None = None,
) -> list[dict]:
    catalog = None
    if weight_mode == WEIGHT_MODE_CUSTOM:
        catalog = load_custom_weight_catalog(custom_weights_dir)
        print(catalog.describe())
        if not catalog.by_key:
            print(
                "[custom-weights] WARNING: custom mode selected but no usable CSVs were loaded. "
                "All themes will fall back to Kendall weights."
            )

    records: list[dict] = []
    for level in levels:
        csv_files = raw_theme_csv_paths(level)
        if not csv_files:
            print(f"No source CSV files in {raw_csv_dir(level)}")
            continue
        active_names: set[str] = set()
        for csv_path in csv_files:
            try:
                records.append(
                    process_csv_file(
                        csv_path,
                        level,
                        catalog=catalog,
                        weight_mode=weight_mode,
                    )
                )
                active_names.add(csv_path.name)
            except ValueError as exc:
                print(f"Skipped {csv_path.name}: {exc}")
                records.append({
                    "source_csv": csv_path.name,
                    "level": level,
                    "theme": _theme_from_filename(csv_path),
                    "action": "error",
                    "error": str(exc),
                    "weight_mode": weight_mode,
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
