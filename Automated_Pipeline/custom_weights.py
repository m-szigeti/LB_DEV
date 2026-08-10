"""
Load sandbox-exported custom weight CSVs for optional pipeline scoring.

Expected files (from the map weight sandbox export):
  *_weights_before_after.csv

Required columns:
  indicator_field, weight_after_normalized
Optional metadata columns used for matching:
  layer_id, resolution, theme_name, exported_at

Place files in Automated_Pipeline/CUSTOM WEIGHTS/ (flat folder is fine).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from config import custom_weights_dir as config_custom_weights_dir, parse_theme_number
from io_utils import read_csv_flexible

WEIGHT_MODE_KENDALL = "kendall"
WEIGHT_MODE_CUSTOM = "custom"
WEIGHT_MODES = (WEIGHT_MODE_KENDALL, WEIGHT_MODE_CUSTOM)

RESOLUTION_TO_LEVEL = {
    "district": "DIS",
    "governorate": "GOV",
    "cadastre": "CAD",
    "dis": "DIS",
    "gov": "GOV",
    "cad": "CAD",
}

LAYER_ID_TO_THEME = {
    "svAdmin3Layer": 2,
    "svAdmin2Layer": 3,
    "svAdmin4Layer": 4,
    "svClimateLayer": 6,
    "svPoliticalLayer": 7,
    "svGenderLayer": 8,
}

THEME_NAME_HINTS = (
    (2, ("tensions", "conflict")),
    (3, ("socioeconomic", "socio-economic", "poverty")),
    (4, ("service", "infrastructure")),
    (6, ("climate", "environmental")),
    (7, ("political",)),
    (8, ("gender",)),
)

SANDBOX_WEIGHTS_SUFFIX = "_weights_before_after.csv"


@dataclass
class CustomWeightSet:
    level: str
    theme: int
    weights: dict[str, float]
    source_path: Path
    exported_at: str = ""
    theme_name: str = ""
    layer_id: str = ""


@dataclass
class CustomWeightCatalog:
    root: Path
    sets: list[CustomWeightSet] = field(default_factory=list)
    by_key: dict[tuple[str, int], CustomWeightSet] = field(default_factory=dict)

    def get(self, level: str, theme: int | None) -> CustomWeightSet | None:
        if theme is None:
            return None
        return self.by_key.get((level.upper(), int(theme)))

    def describe(self) -> str:
        if not self.sets:
            return f"No custom weight CSVs found in {self.root}"
        lines = [f"Loaded {len(self.sets)} custom weight file(s) from {self.root}:"]
        for item in sorted(self.sets, key=lambda s: (s.level, s.theme, s.source_path.name)):
            lines.append(
                f"  [{item.level} T{item.theme}] {item.source_path.name} "
                f"({len(item.weights)} indicators)"
            )
        return "\n".join(lines)


def custom_weights_dir(path: str | Path | None = None) -> Path:
    return config_custom_weights_dir(path)


def _normalize_key(value: object) -> str:
    return str(value or "").strip().casefold()


def _parse_resolution_to_level(resolution: object, fallback_text: str = "") -> str | None:
    text = _normalize_key(resolution)
    if text in RESOLUTION_TO_LEVEL:
        return RESOLUTION_TO_LEVEL[text]
    for token, level in RESOLUTION_TO_LEVEL.items():
        if token in _normalize_key(fallback_text):
            return level
    return None


def _theme_from_layer_id(layer_id: object) -> int | None:
    key = str(layer_id or "").strip()
    return LAYER_ID_TO_THEME.get(key)


def _theme_from_name(theme_name: object, fallback_text: str = "") -> int | None:
    blob = f"{theme_name or ''} {fallback_text or ''}".casefold()
    for theme, hints in THEME_NAME_HINTS:
        if any(hint in blob for hint in hints):
            return theme
    return parse_theme_number(None, fallback_text)


def _exported_at_sort_key(value: object, path: Path) -> str:
    text = str(value or "").strip()
    if text:
        return text
    # Filename timestamps like 2026-08-10-12-01-22
    match = re.search(r"(20\d{2}-\d{2}-\d{2}[-_]\d{2}-\d{2}-\d{2})", path.stem)
    return match.group(1) if match else path.name


def _read_weight_rows(path: Path) -> pd.DataFrame:
    df = read_csv_flexible(path)
    columns = {str(c).strip().casefold(): c for c in df.columns}
    field_col = columns.get("indicator_field") or columns.get("indicator")
    weight_col = (
        columns.get("weight_after_normalized")
        or columns.get("final_weight")
        or columns.get("weight")
    )
    if not field_col or not weight_col:
        raise ValueError(
            f"{path.name}: expected indicator_field + weight_after_normalized "
            "(sandbox export) or Indicator + Final_Weight"
        )

    out = pd.DataFrame(
        {
            "indicator_field": df[field_col].astype(str).str.strip(),
            "weight_after_normalized": pd.to_numeric(df[weight_col], errors="coerce"),
        }
    )
    for meta in ("layer_id", "resolution", "theme_name", "exported_at"):
        source = columns.get(meta)
        if source:
            out[meta] = df[source]
    out = out[out["indicator_field"].astype(bool)]
    out = out[out["weight_after_normalized"].notna()]
    if out.empty:
        raise ValueError(f"{path.name}: no usable weight rows")
    return out


def load_custom_weight_set(path: Path) -> CustomWeightSet:
    rows = _read_weight_rows(path)
    first = rows.iloc[0]
    layer_id = str(first.get("layer_id", "") or "")
    theme_name = str(first.get("theme_name", "") or "")
    resolution = first.get("resolution", "")
    exported_at = str(first.get("exported_at", "") or "")

    level = _parse_resolution_to_level(resolution, path.name)
    if level is None:
        raise ValueError(f"{path.name}: could not determine resolution/level")

    theme = (
        _theme_from_layer_id(layer_id)
        or _theme_from_name(theme_name, path.name)
        or parse_theme_number(None, path.name)
    )
    if theme is None:
        raise ValueError(f"{path.name}: could not determine theme number")

    weights: dict[str, float] = {}
    for _, row in rows.iterrows():
        name = str(row["indicator_field"]).strip()
        weight = float(row["weight_after_normalized"])
        if not name or weight < 0:
            continue
        weights[name] = weight

    if not weights:
        raise ValueError(f"{path.name}: no valid indicator weights")

    total = sum(weights.values())
    if total <= 0:
        raise ValueError(f"{path.name}: weight sum is zero")
    weights = {key: value / total for key, value in weights.items()}

    return CustomWeightSet(
        level=level,
        theme=int(theme),
        weights=weights,
        source_path=path,
        exported_at=exported_at,
        theme_name=theme_name,
        layer_id=layer_id,
    )


def discover_custom_weight_files(root: Path) -> list[Path]:
    if not root.exists():
        return []
    files: list[Path] = []
    for path in sorted(root.rglob("*.csv")):
        name = path.name.casefold()
        if name.endswith(SANDBOX_WEIGHTS_SUFFIX.casefold()):
            files.append(path)
            continue
        # Also accept pipeline-style sidecars if users drop them in.
        if name.endswith("_weights.csv") and "before_after" not in name:
            files.append(path)
    return files


def load_custom_weight_catalog(root: Path | None = None) -> CustomWeightCatalog:
    directory = custom_weights_dir(root)
    catalog = CustomWeightCatalog(root=directory)
    for path in discover_custom_weight_files(directory):
        try:
            weight_set = load_custom_weight_set(path)
        except ValueError as exc:
            print(f"[custom-weights] Skipped {path.name}: {exc}")
            continue
        catalog.sets.append(weight_set)
        key = (weight_set.level, weight_set.theme)
        existing = catalog.by_key.get(key)
        if existing is None:
            catalog.by_key[key] = weight_set
            continue
        if _exported_at_sort_key(weight_set.exported_at, weight_set.source_path) >= _exported_at_sort_key(
            existing.exported_at, existing.source_path
        ):
            catalog.by_key[key] = weight_set
    return catalog


def match_indicator_weight(
    indicator_cols: list[str],
    custom_weights: dict[str, float],
) -> tuple[dict[str, float], list[str], list[str]]:
    """
    Map custom weight keys onto dataframe indicator columns (trim-aware).

    Returns (matched_weights_by_column, unmatched_indicators, unused_custom_keys).
    """
    custom_by_norm = {_normalize_key(key): (key, float(value)) for key, value in custom_weights.items()}
    matched: dict[str, float] = {}
    unmatched: list[str] = []
    used_norms: set[str] = set()

    for col in indicator_cols:
        exact = custom_weights.get(col)
        if exact is not None:
            matched[col] = float(exact)
            used_norms.add(_normalize_key(col))
            continue
        trimmed = col.strip()
        if trimmed != col and trimmed in custom_weights:
            matched[col] = float(custom_weights[trimmed])
            used_norms.add(_normalize_key(trimmed))
            continue
        norm = _normalize_key(col)
        hit = custom_by_norm.get(norm)
        if hit is None:
            # Allow "State Citizen Incidents " vs "State Citizen Incidents"
            for custom_norm, (custom_key, custom_value) in custom_by_norm.items():
                if custom_norm.strip() == norm.strip():
                    hit = (custom_key, custom_value)
                    break
        if hit is None:
            unmatched.append(col)
            continue
        matched[col] = float(hit[1])
        used_norms.add(_normalize_key(hit[0]))

    used_norms_stripped = {_normalize_key(c).strip() for c in matched}
    unused = [
        key
        for key in custom_weights
        if _normalize_key(key) not in used_norms
        and _normalize_key(key).strip() not in used_norms_stripped
    ]
    return matched, unmatched, unused


def resolve_weights_for_indicators(
    indicator_cols: list[str],
    custom_weights: dict[str, float] | None,
) -> tuple[dict[str, float] | None, str]:
    """
    If custom weights are provided and match, return renormalized weights for
    indicator_cols. Otherwise return None (caller should use Kendall).
    """
    if not custom_weights:
        return None, WEIGHT_MODE_KENDALL

    matched, unmatched, unused = match_indicator_weight(indicator_cols, custom_weights)
    if not matched:
        print(
            "[custom-weights] No indicator names matched custom file; "
            "falling back to Kendall weights."
        )
        return None, WEIGHT_MODE_KENDALL

    if unmatched:
        print(
            "[custom-weights] Indicators missing from custom file "
            f"(set to 0 before renormalize): {unmatched}"
        )
    if unused:
        print(f"[custom-weights] Unused custom indicators: {unused}")

    weights = {col: float(matched.get(col, 0.0)) for col in indicator_cols}
    total = sum(weights.values())
    if total <= 0:
        print("[custom-weights] Matched weights sum to 0; falling back to Kendall.")
        return None, WEIGHT_MODE_KENDALL
    return {col: value / total for col, value in weights.items()}, WEIGHT_MODE_CUSTOM
