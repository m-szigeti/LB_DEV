"""Build a multi-sheet Excel summary of sub-indicator and overall-pillar weights."""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from composite_index_score import detect_columns
from config import (
    COMPOSITE_THEMES,
    LEVELS,
    composite_csv_dir,
    gov_dis_spatial_aggregate_dir,
    overall_vulnerability_dir,
    parse_theme_number,
    reports_dir,
)
from io_utils import read_csv_flexible
from pipeline_sources import one_csv_per_theme, pipeline_theme_csv_paths

SUMMARY_EXCEL_NAME = "Indicator_Weights_Summary.xlsx"
SPATIAL_OVERALL_WEIGHTS_NAME = "GOV_Overall_Vulnerability_Weights__from_dis_spatial.csv"

THEME_SHEET_COLUMNS = [
    "Theme",
    "Theme_Name",
    "Subindicator",
    "Mean_Abs_Kendall_tau",
    "Final_Weight",
    "Composite_Scored",
    "Source_CSV",
]

OVERALL_SHEET_COLUMNS = [
    "Level",
    "Source",
    "Indicator",
    "Mean_Abs_Kendall_tau",
    "Final_Weight",
    "Source_CSV",
]


def _theme_name_from_stem(stem: str, theme: int | None) -> str:
    text = stem
    for prefix in ("GOV ", "DIS ", "CAD "):
        if text.startswith(prefix):
            text = text[len(prefix) :]
            break
    if theme is not None:
        text = re.sub(rf"^Theme\s*{theme}\s*-\s*", "", text, flags=re.IGNORECASE)
    return text.strip()


def _empty_theme_frame() -> pd.DataFrame:
    return pd.DataFrame(columns=THEME_SHEET_COLUMNS)


def _empty_overall_frame() -> pd.DataFrame:
    return pd.DataFrame(columns=OVERALL_SHEET_COLUMNS)


def _collect_level_weights(level: str) -> pd.DataFrame:
    rows: list[dict] = []
    theme_csvs = one_csv_per_theme(pipeline_theme_csv_paths(level))

    for csv_path in theme_csvs:
        theme = parse_theme_number(None, csv_path.stem)
        theme_name = _theme_name_from_stem(csv_path.stem, theme)
        weights_path = composite_csv_dir(level) / f"{csv_path.stem}_Weights.csv"

        if theme in COMPOSITE_THEMES and weights_path.exists():
            weights_df = read_csv_flexible(weights_path)
            for _, weight_row in weights_df.iterrows():
                rows.append(
                    {
                        "Theme": theme,
                        "Theme_Name": theme_name,
                        "Subindicator": weight_row["Indicator"],
                        "Mean_Abs_Kendall_tau": weight_row.get("Mean_Abs_Kendall_tau"),
                        "Final_Weight": weight_row.get("Final_Weight"),
                        "Composite_Scored": "Yes",
                        "Source_CSV": csv_path.name,
                    }
                )
            continue

        df = read_csv_flexible(csv_path)
        _, _, indicator_cols = detect_columns(df)
        for indicator in indicator_cols:
            rows.append(
                {
                    "Theme": theme,
                    "Theme_Name": theme_name,
                    "Subindicator": indicator,
                    "Mean_Abs_Kendall_tau": pd.NA,
                    "Final_Weight": pd.NA,
                    "Composite_Scored": "No",
                    "Source_CSV": csv_path.name,
                }
            )

    if not rows:
        return _empty_theme_frame()

    summary = pd.DataFrame(rows)
    summary = summary.sort_values(
        ["Theme", "Subindicator"],
        na_position="last",
        kind="stable",
    ).reset_index(drop=True)
    return summary


def _append_overall_weights_rows(
    rows: list[dict],
    weights_path: Path,
    level: str,
    source: str,
) -> None:
    if not weights_path.exists():
        print(f"[OVERALL] Missing weights file: {weights_path}")
        return

    weights_df = read_csv_flexible(weights_path)
    for _, weight_row in weights_df.iterrows():
        rows.append(
            {
                "Level": level,
                "Source": source,
                "Indicator": weight_row["Indicator"],
                "Mean_Abs_Kendall_tau": weight_row.get("Mean_Abs_Kendall_tau"),
                "Final_Weight": weight_row.get("Final_Weight"),
                "Source_CSV": weights_path.name,
            }
        )


def _collect_overall_weights() -> pd.DataFrame:
    rows: list[dict] = []

    for level in LEVELS:
        weights_path = (
            overall_vulnerability_dir(level) / f"{level}_Overall_Vulnerability_Weights.csv"
        )
        _append_overall_weights_rows(
            rows,
            weights_path=weights_path,
            level=level,
            source="direct",
        )

    spatial_weights_path = gov_dis_spatial_aggregate_dir() / SPATIAL_OVERALL_WEIGHTS_NAME
    _append_overall_weights_rows(
        rows,
        weights_path=spatial_weights_path,
        level="GOV",
        source="from_dis_spatial",
    )

    if not rows:
        return _empty_overall_frame()

    summary = pd.DataFrame(rows)
    level_order = {level: idx for idx, level in enumerate(LEVELS)}
    source_order = {"direct": 0, "from_dis_spatial": 1}
    summary["_level_order"] = summary["Level"].map(lambda value: level_order.get(value, 99))
    summary["_source_order"] = summary["Source"].map(lambda value: source_order.get(value, 99))
    summary = summary.sort_values(
        ["_level_order", "_source_order", "Indicator"],
        kind="stable",
    ).drop(columns=["_level_order", "_source_order"]).reset_index(drop=True)
    return summary


def run_indicator_weights_summary(
    output_path: Path | None = None,
) -> Path:
    """Write Indicator_Weights_Summary.xlsx with GOV, DIS, CAD, and OVERALL sheets."""
    output_path = output_path or (reports_dir() / SUMMARY_EXCEL_NAME)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    sheets: dict[str, pd.DataFrame] = {}
    for level in LEVELS:
        sheets[level] = _collect_level_weights(level)
        print(
            f"[{level}] Collected {len(sheets[level])} sub-indicator weight row(s) "
            f"across {sheets[level]['Theme'].nunique() if not sheets[level].empty else 0} theme(s)"
        )

    sheets["OVERALL"] = _collect_overall_weights()
    print(
        f"[OVERALL] Collected {len(sheets['OVERALL'])} overall-pillar weight row(s) "
        f"across {sheets['OVERALL']['Source'].nunique() if not sheets['OVERALL'].empty else 0} source(s)"
    )

    temp_path = output_path.with_name(f"{output_path.stem}_tmp{output_path.suffix}")
    with pd.ExcelWriter(temp_path, engine="openpyxl") as writer:
        for sheet_name in (*LEVELS, "OVERALL"):
            sheets[sheet_name].to_excel(writer, sheet_name=sheet_name, index=False)

    try:
        temp_path.replace(output_path)
        written = output_path
    except PermissionError:
        # Target file is open (e.g. in Excel); leave the temp copy for the user.
        print(
            f"Could not overwrite {output_path.name} (file may be open). "
            f"Wrote: {temp_path}"
        )
        written = temp_path

    print(f"Wrote indicator weights summary: {written}")
    return written


if __name__ == "__main__":
    run_indicator_weights_summary()
