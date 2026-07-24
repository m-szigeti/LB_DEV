"""Join Absolute Poverty from NEW_INPUT_2.xlsx into CAD Theme 3 workbook."""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from config import input_excel_dir

POVERTY_COLUMN = "Absolute Poverty"
POVERTY_SOURCE_ALIASES = (
    "Absolute Poverty",
    "Absolute Vulnerability",
)
JOIN_KEY = "ACS_Code"
THEME_SHEET = "Master Sheet"


def _normalize_acs_code(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").astype("Int64")


def _find_poverty_column(columns: list[str]) -> str:
    lookup = {col.strip().casefold(): col for col in columns}
    for alias in POVERTY_SOURCE_ALIASES:
        key = alias.casefold()
        if key in lookup:
            return lookup[key]
    raise ValueError(
        f"No poverty column found. Expected one of: {', '.join(POVERTY_SOURCE_ALIASES)}"
    )


def _load_poverty_source(path: Path, sheet_name: str | None) -> pd.DataFrame:
    workbook = pd.ExcelFile(path)
    if sheet_name:
        if sheet_name not in workbook.sheet_names:
            raise ValueError(
                f"{path.name}: worksheet '{sheet_name}' not found. "
                f"Available: {', '.join(workbook.sheet_names)}"
            )
        sheet = sheet_name
    elif "Cadaster" in workbook.sheet_names:
        sheet = "Cadaster"
    else:
        sheet = workbook.sheet_names[0]

    df = pd.read_excel(path, sheet_name=sheet)
    if JOIN_KEY not in df.columns:
        raise ValueError(f"{path.name} [{sheet}]: missing column '{JOIN_KEY}'")

    poverty_col = _find_poverty_column(list(df.columns))
    poverty = df[[JOIN_KEY, poverty_col]].copy()
    poverty = poverty.rename(columns={poverty_col: POVERTY_COLUMN})
    poverty[JOIN_KEY] = _normalize_acs_code(poverty[JOIN_KEY])
    poverty = poverty.dropna(subset=[JOIN_KEY])
    poverty = poverty.drop_duplicates(subset=[JOIN_KEY], keep="first")
    return poverty


def join_absolute_poverty(
    theme_path: Path,
    source_path: Path,
    output_path: Path,
    source_sheet: str | None = None,
) -> dict[str, int]:
    """Left-join poverty values onto the Theme 3 workbook and write v2 output."""
    theme_df = pd.read_excel(theme_path, sheet_name=THEME_SHEET)
    if JOIN_KEY not in theme_df.columns:
        raise ValueError(f"{theme_path.name}: missing column '{JOIN_KEY}'")

    original_columns = list(theme_df.columns)
    poverty_df = _load_poverty_source(source_path, source_sheet)

    theme_df = theme_df.copy()
    theme_df[JOIN_KEY] = _normalize_acs_code(theme_df[JOIN_KEY])

    if POVERTY_COLUMN in theme_df.columns:
        theme_df = theme_df.drop(columns=[POVERTY_COLUMN])

    result = theme_df.merge(poverty_df, on=JOIN_KEY, how="left")
    result[POVERTY_COLUMN] = result[POVERTY_COLUMN].fillna(0)

    if POVERTY_COLUMN in original_columns:
        result = result[original_columns]
    else:
        result = result[original_columns + [POVERTY_COLUMN]]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        result.to_excel(writer, sheet_name=THEME_SHEET, index=False)

    matched = int(result[JOIN_KEY].isin(poverty_df[JOIN_KEY]).sum())
    unmatched = len(result) - matched
    return {
        "rows": len(result),
        "matched": matched,
        "unmatched_filled_with_zero": unmatched,
    }


def parse_args() -> argparse.Namespace:
    cad_dir = input_excel_dir("CAD")
    parser = argparse.ArgumentParser(
        description=(
            "Join Absolute Poverty from NEW_INPUT_2.xlsx into "
            "CAD Theme 3- Socioeconomic Vulnerability.xlsx."
        )
    )
    parser.add_argument(
        "--theme",
        type=Path,
        default=cad_dir / "CAD Theme 3- Socioeconomic Vulnerability.xlsx",
        help="Existing CAD Theme 3 Excel workbook.",
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=cad_dir / "NEW_INPUT_2.xlsx",
        help="Excel file containing ACS_Code and Absolute Poverty.",
    )
    parser.add_argument(
        "--source-sheet",
        default=None,
        help="Worksheet in the source file (default: Cadaster if present, else first sheet).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=cad_dir / "CAD Theme 3- Socioeconomic Vulnerability v2.xlsx",
        help="Output Excel workbook path.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    stats = join_absolute_poverty(
        theme_path=args.theme,
        source_path=args.source,
        output_path=args.output,
        source_sheet=args.source_sheet,
    )
    print(f"Wrote: {args.output}")
    print(
        f"Rows: {stats['rows']} | matched: {stats['matched']} | "
        f"unmatched (filled with 0): {stats['unmatched_filled_with_zero']}"
    )


if __name__ == "__main__":
    main()
