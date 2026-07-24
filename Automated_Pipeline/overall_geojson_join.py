"""Join overall vulnerability CSV scores into base GeoJSON layers."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from config import (
    LEVEL_JOIN_CONFIG,
    LEVELS,
    OVERALL_GEOJSON_SCORE_FIELD,
    OVERALL_INDEX_CSV_NAME,
    OVERALL_SCORE_COLUMN,
    geojson_dir,
    normalize_join_value,
    overall_vulnerability_dir,
    overall_vulnerability_geojson_dir,
    reports_dir,
)
from geojson_join import _find_column
from io_utils import (
    read_csv_flexible,
    read_geojson_flexible,
    write_csv_unicode,
    write_geojson_unicode,
)


def _base_geojson_path(level: str) -> Path | None:
    geojson_files = sorted(geojson_dir(level).glob("*.geojson"))
    if not geojson_files:
        return None
    if len(geojson_files) == 1:
        return geojson_files[0]
    for path in geojson_files:
        if level.lower() in path.stem.casefold():
            return path
    return geojson_files[0]


def join_overall_to_geojson(level: str) -> dict:
    join_cfg = LEVEL_JOIN_CONFIG[level]
    csv_path = overall_vulnerability_dir(level) / OVERALL_INDEX_CSV_NAME[level]
    if not csv_path.exists():
        raise ValueError(f"Overall index CSV not found: {csv_path}")

    geojson_path = _base_geojson_path(level)
    if geojson_path is None:
        raise ValueError(f"No base GeoJSON found in {geojson_dir(level)}")

    csv_df = read_csv_flexible(csv_path)
    csv_key = _find_column(list(csv_df.columns), (join_cfg["csv_key"],))
    if not csv_key:
        raise ValueError(
            f"{csv_path.name}: required join column '{join_cfg['csv_key']}' not found."
        )
    if OVERALL_SCORE_COLUMN not in csv_df.columns:
        raise ValueError(
            f"{csv_path.name}: required score column '{OVERALL_SCORE_COLUMN}' not found."
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

    score_lookup: dict[str, float] = {}
    duplicate_keys: list[str] = []
    for _, row in csv_df.iterrows():
        key = normalize_join_value(row[csv_key])
        if not key:
            continue
        if key in score_lookup:
            duplicate_keys.append(key)
        score_lookup[key] = row[OVERALL_SCORE_COLUMN]

    matched_csv_keys: set[str] = set()
    unmatched_geo_features: list[dict] = []

    for feature in features:
        props = feature.get("properties", {})
        raw_key = props.get(geo_key)
        key = normalize_join_value(raw_key)
        if not key:
            unmatched_geo_features.append({
                "geojson_key_column": geo_key,
                "geojson_key_value": raw_key,
                "reason": "missing_join_key_in_geojson",
            })
            feature["properties"] = {geo_key: raw_key}
            continue

        score = score_lookup.get(key)
        if score is None:
            unmatched_geo_features.append({
                "geojson_key_column": geo_key,
                "geojson_key_value": raw_key,
                "normalized_key": key,
                "reason": "no_matching_csv_row",
            })
            feature["properties"] = {geo_key: raw_key}
            continue

        feature["properties"] = {
            geo_key: raw_key,
            OVERALL_GEOJSON_SCORE_FIELD: score,
        }
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

    output_path = overall_vulnerability_geojson_dir(level) / f"{level}_Overall_Vulnerability.geojson"
    write_geojson_unicode(geojson, output_path)

    return {
        "level": level,
        "csv_file": csv_path.name,
        "geojson_file": geojson_path.name,
        "output_geojson": str(output_path.relative_to(overall_vulnerability_geojson_dir(level).parent.parent)),
        "csv_join_column": csv_key,
        "geojson_join_column": geo_key,
        "score_field": OVERALL_GEOJSON_SCORE_FIELD,
        "csv_rows": len(csv_df),
        "geojson_features": len(features),
        "matched_features": len(matched_csv_keys),
        "unmatched_csv_rows": len(unmatched_csv_rows),
        "unmatched_geojson_features": len(unmatched_geo_features),
        "duplicate_csv_keys": len(set(duplicate_keys)),
        "unmatched_csv_details": unmatched_csv_rows,
        "unmatched_geojson_details": unmatched_geo_features,
        "duplicate_csv_key_values": sorted(set(duplicate_keys)),
    }


def run_overall_geojson_join(levels: tuple[str, ...] = LEVELS) -> list[dict]:
    results: list[dict] = []
    error_rows: list[dict] = []

    for level in levels:
        try:
            result = join_overall_to_geojson(level)
            results.append({k: v for k, v in result.items() if not k.endswith("_details")})
            print(
                f"[{level}] Overall vulnerability GeoJSON: "
                f"{result['matched_features']} matches, "
                f"{result['unmatched_csv_rows']} unmatched CSV rows, "
                f"{result['unmatched_geojson_features']} unmatched GeoJSON features"
            )
            for row in result["unmatched_csv_details"]:
                error_rows.append({"level": level, **row})
            for row in result["unmatched_geojson_details"]:
                error_rows.append({"level": level, **row})
            for dup in result["duplicate_csv_key_values"]:
                error_rows.append({
                    "level": level,
                    "csv_key_value": dup,
                    "reason": "duplicate_csv_join_key",
                })
        except ValueError as exc:
            print(f"[{level}] Overall GeoJSON join failed: {exc}")
            error_rows.append({"level": level, "error": str(exc)})

    report_dir = reports_dir()
    report_dir.mkdir(parents=True, exist_ok=True)
    if results:
        write_csv_unicode(
            pd.DataFrame(results),
            report_dir / "overall_geojson_join_summary.csv",
            index=False,
        )
    if error_rows:
        write_csv_unicode(
            pd.DataFrame(error_rows),
            report_dir / "overall_geojson_join_errors.csv",
            index=False,
        )
        print(f"Wrote overall join errors: {report_dir / 'overall_geojson_join_errors.csv'}")

    return results


if __name__ == "__main__":
    run_overall_geojson_join()
