"""Join composite CSV attributes into GeoJSON layers and report join errors."""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from config import (
    COMPOSITE_THEMES,
    LEVEL_JOIN_CONFIG,
    LEVELS,
    composite_csv_dir,
    geojson_dir,
    joined_geojson_dir,
    normalize_join_value,
    parse_theme_number,
    reports_dir,
)
from io_utils import (
    read_csv_flexible,
    read_geojson_flexible,
    write_csv_unicode,
    write_geojson_unicode,
)
from pipeline_sources import (
    one_csv_per_theme,
    pipeline_theme_csv_paths,
    prune_stale_joined_geojson,
)


def _find_column(columns: list[str], candidates: tuple[str, ...]) -> str | None:
    lookup = {col.casefold(): col for col in columns}
    for candidate in candidates:
        match = lookup.get(candidate.casefold())
        if match:
            return match
    return None


def _theme_from_stem(stem: str) -> int | None:
    return parse_theme_number(None, stem)


def _match_geojson_for_csv(csv_path: Path, geojson_files: list[Path]) -> Path | None:
    csv_theme = _theme_from_stem(csv_path.stem)
    if csv_theme is None:
        if len(geojson_files) == 1:
            return geojson_files[0]
        return None

    theme_matches = [
        path for path in geojson_files if _theme_from_stem(path.stem) == csv_theme
    ]
    if len(theme_matches) == 1:
        return theme_matches[0]
    if len(theme_matches) > 1:
        csv_tokens = set(re.findall(r"[a-z0-9]+", csv_path.stem.casefold()))
        best_score = -1
        best_path: Path | None = None
        for candidate in theme_matches:
            geo_tokens = set(re.findall(r"[a-z0-9]+", candidate.stem.casefold()))
            score = len(csv_tokens & geo_tokens)
            if score > best_score:
                best_score = score
                best_path = candidate
        return best_path
    if len(geojson_files) == 1:
        # Base-layer mode: one GeoJSON per admin level reused for all themes.
        return geojson_files[0]
    return None


def _prepare_csv_lookup(
    csv_df: pd.DataFrame,
    csv_key: str,
    indicator_cols: list[str],
    theme: int | None,
) -> tuple[dict[str, dict], list[str]]:
    if csv_key not in csv_df.columns:
        raise ValueError(f"CSV missing join column '{csv_key}'")

    include_composite = theme in COMPOSITE_THEMES and "composite_score" in csv_df.columns

    lookup: dict[str, dict] = {}
    duplicate_keys: list[str] = []
    for _, row in csv_df.iterrows():
        key = normalize_join_value(row[csv_key])
        if not key:
            continue
        payload = {col: row[col] for col in indicator_cols if col in csv_df.columns}
        if include_composite:
            payload["composite_score"] = row["composite_score"]
        if key in lookup:
            duplicate_keys.append(key)
        lookup[key] = payload
    return lookup, duplicate_keys


def join_csv_to_geojson(csv_path: Path, geojson_path: Path, level: str) -> dict:
    join_cfg = LEVEL_JOIN_CONFIG[level]
    theme = _theme_from_stem(csv_path.stem)
    csv_df = read_csv_flexible(csv_path)

    csv_key = _find_column(list(csv_df.columns), (join_cfg["csv_key"],))
    if not csv_key:
        raise ValueError(
            f"{csv_path.name}: required join column '{join_cfg['csv_key']}' not found."
        )

    geojson = read_geojson_flexible(geojson_path)

    features = geojson.get("features", [])
    if not features:
        raise ValueError(f"{geojson_path.name}: no features found.")

    sample_props = features[0].get("properties", {})
    geo_key = _find_column(list(sample_props.keys()), join_cfg["geojson_keys"])
    if not geo_key:
        raise ValueError(
            f"{geojson_path.name}: none of the expected join keys found: "
            f"{', '.join(join_cfg['geojson_keys'])}"
        )

    metadata_cols = {
        col for col in csv_df.columns
        if col.casefold() in {join_cfg["csv_key"].casefold(), "adm1_name", "adm2_name", "adm3_name", "acs_code"}
        or col in join_cfg.get("required_csv_columns", ())
    }
    indicator_cols = [
        col for col in csv_df.columns
        if col not in metadata_cols and col != "composite_score"
    ]

    lookup, duplicate_csv_keys = _prepare_csv_lookup(
        csv_df, csv_key, indicator_cols, theme
    )

    matched_csv_keys: set[str] = set()
    unmatched_geo_features: list[dict] = []

    for feature in features:
        props = feature.setdefault("properties", {})
        raw_key = props.get(geo_key)
        key = normalize_join_value(raw_key)
        if not key:
            unmatched_geo_features.append({
                "geojson_key_column": geo_key,
                "geojson_key_value": raw_key,
                "reason": "missing_join_key_in_geojson",
            })
            continue
        if key not in lookup:
            unmatched_geo_features.append({
                "geojson_key_column": geo_key,
                "geojson_key_value": raw_key,
                "normalized_key": key,
                "reason": "no_matching_csv_row",
            })
            continue
        props.update(lookup[key])
        matched_csv_keys.add(key)

    unmatched_csv_rows = []
    for _, row in csv_df.iterrows():
        key = normalize_join_value(row[csv_key])
        if key and key not in matched_csv_keys:
            unmatched_csv_rows.append({
                "csv_key_column": csv_key,
                "csv_key_value": row[csv_key],
                "normalized_key": key,
                "reason": "no_matching_geojson_feature",
            })

    output_path = joined_geojson_dir(level) / f"{csv_path.stem}__joined.geojson"
    write_geojson_unicode(geojson, output_path)

    return {
        "level": level,
        "csv_file": csv_path.name,
        "theme": theme,
        "geojson_file": geojson_path.name,
        "output_geojson": str(output_path.relative_to(joined_geojson_dir(level).parent.parent)),
        "csv_join_column": csv_key,
        "geojson_join_column": geo_key,
        "csv_rows": len(csv_df),
        "geojson_features": len(features),
        "matched_features": len(matched_csv_keys),
        "unmatched_csv_rows": len(unmatched_csv_rows),
        "unmatched_geojson_features": len(unmatched_geo_features),
        "duplicate_csv_keys": len(set(duplicate_csv_keys)),
        "unmatched_csv_details": unmatched_csv_rows,
        "unmatched_geojson_details": unmatched_geo_features,
        "duplicate_csv_key_values": sorted(set(duplicate_csv_keys)),
    }


def run_geojson_join(levels: tuple[str, ...] = LEVELS) -> list[dict]:
    results: list[dict] = []
    error_rows: list[dict] = []

    for level in levels:
        csv_files = one_csv_per_theme(pipeline_theme_csv_paths(level))
        geo_dir = geojson_dir(level)
        geojson_files = sorted(geo_dir.glob("*.geojson"))

        if not csv_files:
            print(f"No pipeline theme CSV files to join in {composite_csv_dir(level)}")
            continue
        if not geojson_files:
            print(f"No GeoJSON base layers in {geo_dir}")
            continue

        for csv_path in csv_files:
            geojson_path = _match_geojson_for_csv(csv_path, geojson_files)
            if geojson_path is None:
                message = f"No GeoJSON match for {csv_path.name} in {geo_dir}"
                print(message)
                error_rows.append({
                    "level": level,
                    "csv_file": csv_path.name,
                    "error": message,
                })
                continue
            try:
                result = join_csv_to_geojson(csv_path, geojson_path, level)
                results.append({k: v for k, v in result.items() if not k.endswith("_details")})
                print(
                    f"Joined {csv_path.name} + {geojson_path.name}: "
                    f"{result['matched_features']} matches, "
                    f"{result['unmatched_csv_rows']} unmatched CSV rows, "
                    f"{result['unmatched_geojson_features']} unmatched GeoJSON features"
                )

                for row in result["unmatched_csv_details"]:
                    error_rows.append({"level": level, "csv_file": csv_path.name, **row})
                for row in result["unmatched_geojson_details"]:
                    error_rows.append({"level": level, "geojson_file": geojson_path.name, **row})
                for dup in result["duplicate_csv_key_values"]:
                    error_rows.append({
                        "level": level,
                        "csv_file": csv_path.name,
                        "csv_key_value": dup,
                        "reason": "duplicate_csv_join_key",
                    })
            except ValueError as exc:
                print(f"Join failed for {csv_path.name}: {exc}")
                error_rows.append({
                    "level": level,
                    "csv_file": csv_path.name,
                    "error": str(exc),
                })

        removed = prune_stale_joined_geojson(level, {path.stem for path in csv_files})
        if removed:
            print(f"[{level}] Removed {len(removed)} stale joined GeoJSON file(s)")

    reports_path = reports_dir()
    reports_path.mkdir(parents=True, exist_ok=True)
    if results:
        write_csv_unicode(
            pd.DataFrame(results),
            reports_path / "geojson_join_summary.csv",
            index=False,
        )
    if error_rows:
        write_csv_unicode(
            pd.DataFrame(error_rows),
            reports_path / "join_errors.csv",
            index=False,
        )
        print(f"Wrote join errors: {reports_path / 'join_errors.csv'}")

    return results


if __name__ == "__main__":
    run_geojson_join()
