"""Pipeline configuration for Automated_Pipeline."""

from __future__ import annotations

import re
from contextlib import contextmanager
from contextvars import ContextVar
from pathlib import Path
from typing import Iterator

PIPELINE_ROOT = Path(__file__).resolve().parent

LEVELS = ("GOV", "DIS", "CAD")
COMPOSITE_THEMES = frozenset({2, 3, 4, 6, 7, 8})
SKIP_COMPOSITE_THEMES = frozenset({1, 5})
ALL_THEMES = frozenset({1, 2, 3, 4, 5, 6, 7, 8})

# Output trees (never write joined/overall exports into the source GEOJSON/ folder).
DEFAULT_OUTPUT_ROOT_NAME = "DEFAULT"
CUSTOM_OUTPUT_ROOT_NAME = "CUSTOM"
VARIANT_STANDARD = "standard"
VARIANT_CUSTOM = "custom"
VARIANT_BOTH = "both"
PIPELINE_VARIANTS = (VARIANT_STANDARD, VARIANT_CUSTOM, VARIANT_BOTH)

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

_output_root: ContextVar[Path | None] = ContextVar("pipeline_output_root", default=None)


def default_output_root() -> Path:
    """Kendall / default pipeline outputs."""
    return PIPELINE_ROOT / DEFAULT_OUTPUT_ROOT_NAME


def custom_output_root() -> Path:
    """Custom-weight pipeline outputs."""
    return PIPELINE_ROOT / CUSTOM_OUTPUT_ROOT_NAME


def get_output_root() -> Path:
    """Active output root (DEFAULT/ or CUSTOM/). Inputs always use PIPELINE_ROOT."""
    return _output_root.get() or default_output_root()


def is_custom_output_root() -> bool:
    return get_output_root().resolve() == custom_output_root().resolve()


@contextmanager
def using_output_root(root: Path) -> Iterator[Path]:
    """Redirect composite/joined/overall/report outputs to ``root``."""
    token = _output_root.set(Path(root).resolve())
    try:
        yield get_output_root()
    finally:
        _output_root.reset(token)


def pipeline_dir(name: str, level: str | None = None, *, output: bool = False) -> Path:
    """
    Resolve a pipeline folder.

    output=False → always under PIPELINE_ROOT (shared inputs / source GEOJSON).
    output=True  → under the active output root (DEFAULT/ or CUSTOM/).
    """
    root = get_output_root() if output else PIPELINE_ROOT
    path = root / name
    if level:
        path = path / level
    return path


def input_excel_dir(level: str) -> Path:
    return pipeline_dir("INPUT_EXCEL", level, output=False)


def raw_csv_dir(level: str) -> Path:
    return pipeline_dir("RAW_CSV", level, output=False)


def composite_csv_dir(level: str) -> Path:
    return pipeline_dir("CSV_COMPOSITE", level, output=True)


def geojson_dir(level: str) -> Path:
    """Source admin GeoJSON polygons only (shared input; never an export target)."""
    return pipeline_dir("GEOJSON", level, output=False)


def joined_geojson_dir(level: str) -> Path:
    """
    Joined theme GeoJSON exports under DEFAULT/GEOJSON/.../joined or CUSTOM/GEOJSON/.../joined.
    Never writes into the source PIPELINE_ROOT/GEOJSON/ tree.
    """
    return pipeline_dir("GEOJSON", level, output=True) / "joined"


def gov_dis_spatial_aggregate_dir() -> Path:
    """GOV layers upscaled from DIS via spatial aggregation."""
    return joined_geojson_dir("GOV") / "from_dis_spatial"


def custom_weights_dir(path: str | Path | None = None) -> Path:
    """Folder for sandbox *_weights_before_after.csv inputs (shared)."""
    if path is None:
        return pipeline_dir("CUSTOM WEIGHTS", output=False)
    candidate = Path(path)
    if not candidate.is_absolute():
        candidate = PIPELINE_ROOT / candidate
    return candidate


def reports_dir() -> Path:
    return pipeline_dir("REPORTS", output=True)


def extracted_composite_dir(level: str) -> Path:
    return pipeline_dir("EXTRACTED COMPOSITE SCORES", level, output=True)


def overall_vulnerability_dir(level: str) -> Path:
    return pipeline_dir("OVERALL VULNERABILITY LAYERS", level, output=True)


def overall_vulnerability_geojson_dir(level: str) -> Path:
    return pipeline_dir("OVERALL VULNERABILITY LAYERS", level, output=True) / "geojson"


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
