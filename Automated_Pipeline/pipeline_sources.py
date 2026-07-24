"""Helpers for identifying active pipeline CSV outputs (excluding legacy files)."""

from __future__ import annotations

from pathlib import Path

from composite_index_score import is_source_csv
from config import composite_csv_dir, joined_geojson_dir, parse_theme_number, raw_csv_dir

LEGACY_CSV_MARKERS = ("for scoring",)


def is_legacy_csv_name(name: str) -> bool:
    return any(marker in name.casefold() for marker in LEGACY_CSV_MARKERS)


def raw_theme_csv_paths(level: str) -> list[Path]:
    source_dir = raw_csv_dir(level)
    if not source_dir.exists():
        return []
    return sorted(
        path
        for path in source_dir.glob("*.csv")
        if is_source_csv(path) and not is_legacy_csv_name(path.name)
    )


def raw_theme_csv_names(level: str) -> set[str]:
    return {path.name for path in raw_theme_csv_paths(level)}


def pipeline_theme_csv_paths(level: str) -> list[Path]:
    """Composite CSVs that correspond to current RAW_CSV theme exports."""
    names = raw_theme_csv_names(level)
    if not names:
        return []
    out_dir = composite_csv_dir(level)
    if not out_dir.exists():
        return []
    return sorted(
        path
        for path in out_dir.glob("*.csv")
        if path.name in names and not is_legacy_csv_name(path.name)
    )


def one_csv_per_theme(csv_paths: list[Path]) -> list[Path]:
    by_theme: dict[int, Path] = {}
    for path in csv_paths:
        theme = parse_theme_number(None, path.stem)
        if theme is None:
            continue
        by_theme[theme] = path
    return [by_theme[theme] for theme in sorted(by_theme)]


def prune_stale_composite_outputs(level: str, active_csv_names: set[str]) -> list[str]:
    """Remove composite CSV sidecars not produced from current RAW_CSV inputs."""
    removed: list[str] = []
    out_dir = composite_csv_dir(level)
    if not out_dir.exists():
        return removed

    active_stems = {Path(name).stem for name in active_csv_names}

    for path in sorted(out_dir.glob("*.csv")):
        if path.name.endswith("_Weights.csv"):
            stem = path.name[: -len("_Weights.csv")]
        elif path.name.endswith("_Kendall_Matrix.csv"):
            stem = path.name[: -len("_Kendall_Matrix.csv")]
        else:
            stem = path.stem

        if stem in active_stems and not is_legacy_csv_name(path.name):
            continue

        path.unlink()
        removed.append(path.name)

    return removed


def prune_stale_joined_geojson(level: str, active_csv_stems: set[str]) -> list[str]:
    """Remove joined GeoJSON files that no longer map to active theme CSVs."""
    removed: list[str] = []
    out_dir = joined_geojson_dir(level)
    if not out_dir.exists():
        return removed

    suffix = "__joined.geojson"
    for path in sorted(out_dir.glob(f"*{suffix}")):
        stem = path.name[: -len(suffix)]
        if stem in active_csv_stems and not is_legacy_csv_name(stem):
            continue
        path.unlink()
        removed.append(path.name)

    return removed
