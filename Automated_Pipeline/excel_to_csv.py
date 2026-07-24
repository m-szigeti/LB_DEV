"""Convert Excel workbooks to CSV files guided by each workbook's Master Sheet."""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from config import (
    LEVELS,
    MASTER_COLUMN_ALIASES,
    MASTER_SHEET_NAMES,
    input_excel_dir,
    parse_level,
    parse_theme_number,
    raw_csv_dir,
    reports_dir,
)
from io_utils import write_csv_unicode


def _normalize_header(value: object) -> str:
    return re.sub(r"[\s_]+", "_", str(value).strip().casefold())


def _resolve_master_columns(columns: list[str]) -> dict[str, str]:
    normalized = {_normalize_header(col): col for col in columns}
    resolved: dict[str, str] = {}
    for canonical, aliases in MASTER_COLUMN_ALIASES.items():
        for alias in aliases:
            key = _normalize_header(alias)
            if key in normalized:
                resolved[canonical] = normalized[key]
                break
    if "sheet_name" not in resolved:
        raise ValueError(
            "Master Sheet must include a worksheet column "
            "(e.g. Sheet_Name, Worksheet, Data_Sheet)."
        )
    return resolved


def _truthy(value: object) -> bool:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return True
    text = str(value).strip().casefold()
    if text in ("", "y", "yes", "true", "1", "x", "include", "export"):
        return True
    return text not in ("n", "no", "false", "0", "skip", "exclude")


def _find_master_sheet(excel_path: Path, workbook: pd.ExcelFile) -> str:
    sheet_lookup = {name.casefold(): name for name in workbook.sheet_names}
    for candidate in MASTER_SHEET_NAMES:
        if candidate.casefold() in sheet_lookup:
            return sheet_lookup[candidate.casefold()]
    raise ValueError(
        f"{excel_path.name}: no Master Sheet found. "
        f"Expected one of: {', '.join(MASTER_SHEET_NAMES)}"
    )


def _output_csv_name(row: pd.Series, columns: dict[str, str], sheet_name: str) -> str:
    if "output_name" in columns:
        value = row[columns["output_name"]]
        if value is not None and str(value).strip() not in ("", "nan"):
            name = str(value).strip()
            return name if name.lower().endswith(".csv") else f"{name}.csv"
    safe_name = re.sub(r'[<>:"/\\|?*]+', "_", sheet_name).strip()
    return f"{safe_name}.csv"


def export_workbook(excel_path: Path, default_level: str) -> list[dict]:
    """Export data from Master Sheet metadata rows or direct single-sheet table."""
    records: list[dict] = []
    workbook = pd.ExcelFile(excel_path)
    master_sheet = _find_master_sheet(excel_path, workbook)
    master_df = pd.read_excel(excel_path, sheet_name=master_sheet)
    master_df = master_df.dropna(how="all")
    try:
        columns = _resolve_master_columns(list(master_df.columns))
    except ValueError:
        # Single-sheet mode: workbook has only "Master Sheet", which is itself the data table.
        level = parse_level(None, excel_path.stem) or default_level
        theme = parse_theme_number(None, excel_path.stem)
        output_name = f"{excel_path.stem}.csv"
        output_path = raw_csv_dir(level) / output_name
        output_path.parent.mkdir(parents=True, exist_ok=True)
        write_csv_unicode(master_df, output_path, index=False)
        record = {
            "excel_file": excel_path.name,
            "sheet_name": master_sheet,
            "level": level,
            "theme": theme,
            "output_csv": str(output_path.relative_to(raw_csv_dir(level).parent.parent)),
            "mode": "single_master_sheet",
        }
        records.append(record)
        print(f"Exported single-sheet workbook {excel_path.name} -> {output_path}")
        return records

    for idx, row in master_df.iterrows():
        if "export" in columns and not _truthy(row[columns["export"]]):
            continue

        sheet_name = str(row[columns["sheet_name"]]).strip()
        if not sheet_name or sheet_name.lower() == "nan":
            continue

        level = parse_level(row.get(columns.get("level", ""), None), sheet_name) or default_level
        theme = parse_theme_number(
            row.get(columns.get("theme", ""), None),
            f"{sheet_name} {excel_path.stem}",
        )
        output_name = _output_csv_name(row, columns, sheet_name)
        output_path = raw_csv_dir(level) / output_name

        if sheet_name not in workbook.sheet_names:
            raise ValueError(
                f"{excel_path.name} row {idx + 2}: worksheet '{sheet_name}' not found."
            )

        data_df = pd.read_excel(excel_path, sheet_name=sheet_name)
        data_df = data_df.dropna(how="all")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        write_csv_unicode(data_df, output_path, index=False)

        record = {
            "excel_file": excel_path.name,
            "sheet_name": sheet_name,
            "level": level,
            "theme": theme,
            "output_csv": str(output_path.relative_to(raw_csv_dir(level).parent.parent)),
        }
        records.append(record)
        print(f"Exported {sheet_name} -> {output_path}")

    return records


def run_excel_to_csv(levels: tuple[str, ...] = LEVELS) -> list[dict]:
    all_records: list[dict] = []
    for level in levels:
        excel_dir = input_excel_dir(level)
        excel_files = sorted(excel_dir.glob("*.xlsx")) + sorted(excel_dir.glob("*.xlsm"))
        if not excel_files:
            print(f"No Excel files in {excel_dir}")
            continue
        for excel_path in excel_files:
            all_records.extend(export_workbook(excel_path, default_level=level))

    if all_records:
        report_path = reports_dir() / "excel_export_log.csv"
        report_path.parent.mkdir(parents=True, exist_ok=True)
        write_csv_unicode(pd.DataFrame(all_records), report_path, index=False)
        print(f"Wrote export log: {report_path}")

    return all_records


if __name__ == "__main__":
    run_excel_to_csv()
