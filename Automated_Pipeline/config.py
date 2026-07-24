"""Pipeline configuration for Automated_Pipeline."""

from __future__ import annotations

import re
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parent

LEVELS = ("GOV", "DIS", "CAD")
COMPOSITE_THEMES = frozenset({2, 3, 4, 6, 7, 8})
SKIP_COMPOSITE_THEMES = frozenset({1, 5})
ALL_THEMES = frozenset({1, 2, 3, 4, 5, 6, 7, 8})

MASTER_SHEET_NAMES = ("Master Sheet", "Master_Sheet", "Master sheet")

# Master Sheet column aliases (case-insensitive).
MASTER_COLUMN_ALIASES = {
    "sheet_name": ("sheet_name", "sheet", "worksheet", "data_sheet", "tab", "source_sheet"),
    "output_name": (
        "output_name",
        "output_filename",
        "output_file",
        "output_csv",
        "csv_name",
        "file_name",
        "filename",
    ),
    "theme": ("theme", "theme_number", "theme_no", "t"),
    "level": ("level", "admin_level", "resolution", "adm_level"),
    "export": ("export", "active", "include", "enabled", "process"),
}

LEVEL_JOIN_CONFIG = {
    "GOV": {
        "csv_key": "ADM1_Name",
        "geojson_keys": ("adm1_name",),
        "required_csv_columns": ("ADM1_Name",),
    },
    "DIS": {
        "csv_key": "ADM2_Name",
        "geojson_keys": ("adm2_name",),
        "required_csv_columns": ("ADM2_Name",),
    },
    "CAD": {
        "csv_key": "ACS_Code",
        "geojson_keys": ("adm3_pcode",),
        "required_csv_columns": ("ADM3_Name", "ACS_Code"),
    },
}

THEME_PATTERN = re.compile(r"(?:theme|t)\s*(\d+)", re.IGNORECASE)
LEVEL_PREFIX_PATTERN = re.compile(r"^(GOV|DIS|CAD)\b", re.IGNORECASE)


def pipeline_dir(name: str, level: str | None = None) -> Path:
    path = PIPELINE_ROOT / name
    if level:
        path = path / level
    return path


def input_excel_dir(level: str) -> Path:
    return pipeline_dir("INPUT_EXCEL", level)


def raw_csv_dir(level: str) -> Path:
    return pipeline_dir("RAW_CSV", level)


def composite_csv_dir(level: str) -> Path:
    return pipeline_dir("CSV_COMPOSITE", level)


def geojson_dir(level: str) -> Path:
    return pipeline_dir("GEOJSON", level)


def joined_geojson_dir(level: str) -> Path:
    return pipeline_dir("GEOJSON", level) / "joined"


def gov_dis_spatial_aggregate_dir() -> Path:
    """GOV joined layers upscaled from DIS via spatial aggregation."""
    return joined_geojson_dir("GOV") / "from_dis_spatial"


def reports_dir() -> Path:
    return pipeline_dir("REPORTS")


def extracted_composite_dir(level: str) -> Path:
    return pipeline_dir("EXTRACTED COMPOSITE SCORES", level)


def overall_vulnerability_dir(level: str) -> Path:
    return pipeline_dir("OVERALL VULNERABILITY LAYERS", level)


def overall_vulnerability_geojson_dir(level: str) -> Path:
    return pipeline_dir("OVERALL VULNERABILITY LAYERS", level) / "geojson"


OVERALL_INDEX_CSV_NAME = {
    "GOV": "GOV_Overall_Vulnerability_Index.csv",
    "DIS": "DIS_Overall_Vulnerability_Index.csv",
    "CAD": "CAD_Overall_Vulnerability_Index.csv",
}

OVERALL_SCORE_COLUMN = "composite_score"
OVERALL_GEOJSON_SCORE_FIELD = "overall_vulnerability_score"


def parse_theme_number(value: object, fallback_text: str = "") -> int | None:
    if value is not None and str(value).strip() not in ("", "nan"):
        try:
            return int(float(str(value).strip()))
        except ValueError:
            pass
    match = THEME_PATTERN.search(str(fallback_text))
    return int(match.group(1)) if match else None


def parse_level(value: object, fallback_text: str = "") -> str | None:
    if value is not None:
        text = str(value).strip().upper()
        if text in LEVELS:
            return text
    match = LEVEL_PREFIX_PATTERN.search(str(fallback_text))
    return match.group(1).upper() if match else None


def normalize_join_value(value: object) -> str:
    if value is None or (isinstance(value, float) and str(value) == "nan"):
        return ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if float(value).is_integer():
            return str(int(value))
        return str(value).strip()
    return str(value).strip().casefold()
