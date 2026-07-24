"""Spatially aggregate DIS joined theme GeoJSON layers to GOV level."""

from __future__ import annotations

import json
import re
from pathlib import Path

import geopandas as gpd
import pandas as pd

from composite_index_score import score_dataframe
from config import (
    ALL_THEMES,
    COMPOSITE_THEMES,
    OVERALL_GEOJSON_SCORE_FIELD,
    gov_dis_spatial_aggregate_dir,
    geojson_dir,
    joined_geojson_dir,
    parse_theme_number,
    reports_dir,
)
from io_utils import write_csv_unicode, write_geojson_unicode
from overall_vulnerability import (
    THEME_OUTPUT_COLUMN,
    _build_overall_score,
    _find_metric_column,
)

DIS_JOINED_SUFFIX = "__joined.geojson"
GOV_JOINED_SUFFIX = "__joined.geojson"
SPATIAL_THEME_SUFFIX = "__from_dis_spatial.geojson"
SPATIAL_EXTRACTED_CSV = "GOV_Extracted_Composite_Scores__from_dis_spatial.csv"
SPATIAL_OVERALL_INDEX_CSV = "GOV_Overall_Vulnerability_Index__from_dis_spatial.csv"
SPATIAL_OVERALL_WEIGHTS_CSV = "GOV_Overall_Vulnerability_Weights__from_dis_spatial.csv"
SPATIAL_OVERALL_KENDALL_CSV = "GOV_Overall_Vulnerability_Kendall_Matrix__from_dis_spatial.csv"
SPATIAL_OVERALL_GEOJSON = "GOV_Overall_Vulnerability__from_dis_spatial.geojson"
GOV_GEO_KEY = "adm1_name"
DIS_ID_KEY = "adm2_name"
GOV_ID_FOR_SCORING = "ADM1_Name"

DIS_METADATA_PATTERNS = (
    re.compile(r"^adm\d+_", re.IGNORECASE),
    re.compile(r"^district$", re.IGNORECASE),
)

SUM_NAME_PATTERNS = (
    re.compile(r"\bincident", re.IGNORECASE),
    re.compile(r"\bfatalit", re.IGNORECASE),
    re.compile(r"^number of\b", re.IGNORECASE),
    re.compile(r"\bpopulation\b", re.IGNORECASE),
    re.compile(r"\bidps?\b", re.IGNORECASE),
    re.compile(r"\boutside cs\b", re.IGNORECASE),
    re.compile(r"\binside cs\b", re.IGNORECASE),
    re.compile(r"\boverall idps\b", re.IGNORECASE),
    re.compile(r"\bresident population\b", re.IGNORECASE),
    re.compile(r"\bdisplaced population\b", re.IGNORECASE),
)

MEAN_NAME_PATTERNS = (
    re.compile(r"\bratio\b", re.IGNORECASE),
    re.compile(r"\brate\b", re.IGNORECASE),
    re.compile(r"\bscore\b", re.IGNORECASE),
    re.compile(r"\blevel\b", re.IGNORECASE),
    re.compile(r"\bpoverty\b", re.IGNORECASE),
    re.compile(r"\bdeprivation\b", re.IGNORECASE),
    re.compile(r"\bperception", re.IGNORECASE),
    re.compile(r"\bworry\b", re.IGNORECASE),
    re.compile(r"\bfear\b", re.IGNORECASE),
    re.compile(r"\bfeeling\b", re.IGNORECASE),
    re.compile(r"\bheterogeneity\b", re.IGNORECASE),
    re.compile(r"\bdemographic factor\b", re.IGNORECASE),
    re.compile(r"\binsecurity\b", re.IGNORECASE),
    re.compile(r"\bradiance\b", re.IGNORECASE),
    re.compile(r"\btendency\b", re.IGNORECASE),
    re.compile(r"\bdependency\b", re.IGNORECASE),
    re.compile(r"\bavailability\b", re.IGNORECASE),
    re.compile(r"\baccessibility\b", re.IGNORECASE),
    re.compile(r"\bquality\b", re.IGNORECASE),
    re.compile(r"\bpressure\b", re.IGNORECASE),
    re.compile(r"\bdriver\b", re.IGNORECASE),
)

COLUMN_AGGREGATION_OVERRIDES = {
    "Population dependency ratio": "mean",
    "Displacement Ratio": "mean",
    "Demographic Factor": "mean",
}


def _is_metadata_column(name: str) -> bool:
    return any(pattern.search(name) for pattern in DIS_METADATA_PATTERNS)


def _indicator_columns(gdf: gpd.GeoDataFrame, theme: int) -> list[str]:
    cols: list[str] = []
    for col in gdf.columns:
        if col == "geometry" or _is_metadata_column(col):
            continue
        if col == "composite_score":
            continue
        if pd.api.types.is_numeric_dtype(gdf[col]):
            cols.append(col)
    return cols


def aggregation_method_for_column(column: str) -> str:
    if column in COLUMN_AGGREGATION_OVERRIDES:
        return COLUMN_AGGREGATION_OVERRIDES[column]
    if any(pattern.search(column) for pattern in MEAN_NAME_PATTERNS):
        return "mean"
    if any(pattern.search(column) for pattern in SUM_NAME_PATTERNS):
        return "sum"
    return "mean"


def _aggregation_plan(value_cols: list[str]) -> dict[str, str]:
    return {col: aggregation_method_for_column(col) for col in value_cols}


def _base_gov_geojson() -> Path | None:
    geojson_files = sorted(geojson_dir("GOV").glob("*.geojson"))
    if not geojson_files:
        return None
    if len(geojson_files) == 1:
        return geojson_files[0]
    for path in geojson_files:
        if "adm1" in path.stem.casefold():
            return path
    return geojson_files[0]


def _find_joined_file_for_theme(level: str, theme: int) -> Path | None:
    joined_dir = joined_geojson_dir(level)
    matches = [
        path
        for path in joined_dir.glob(f"*{GOV_JOINED_SUFFIX if level == 'GOV' else DIS_JOINED_SUFFIX}")
        if parse_theme_number(None, path.stem) == theme
    ]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        return sorted(matches)[0]
    return None


def _gov_output_stem(theme: int, dis_path: Path) -> str:
    gov_joined = _find_joined_file_for_theme("GOV", theme)
    if gov_joined is not None:
        return gov_joined.name[: -len(GOV_JOINED_SUFFIX)]
    dis_stem = dis_path.name[: -len(DIS_JOINED_SUFFIX)]
    return dis_stem.replace("DIS ", "GOV ", 1)


def _metric_crs(gdf: gpd.GeoDataFrame) -> str:
    try:
        return gdf.estimate_utm_crs().to_string()
    except Exception:
        return "EPSG:32636"


def _recompute_composite_score(gov_gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Recompute composite_score from spatially aggregated indicators (never mean district scores)."""
    attr_df = pd.DataFrame(gov_gdf.drop(columns="geometry"))
    attr_df = attr_df.rename(columns={GOV_GEO_KEY: GOV_ID_FOR_SCORING})
    scored_df, _, _, _ = score_dataframe(attr_df)
    score_lookup = scored_df[[GOV_ID_FOR_SCORING, "composite_score"]].rename(
        columns={GOV_ID_FOR_SCORING: GOV_GEO_KEY}
    )
    gov_out = gov_gdf.drop(columns=["composite_score"], errors="ignore").merge(
        score_lookup,
        on=GOV_GEO_KEY,
        how="left",
    )
    return gpd.GeoDataFrame(gov_out, geometry=gov_out.geometry, crs=gov_gdf.crs)


def aggregate_dis_to_gov(dis_path: Path, gov_path: Path, theme: int) -> tuple[gpd.GeoDataFrame, dict]:
    dis = gpd.read_file(dis_path)
    gov = gpd.read_file(gov_path)

    if dis.crs is None:
        dis = dis.set_crs("EPSG:4326")
    if gov.crs is None:
        gov = gov.set_crs("EPSG:4326")

    metric_crs = _metric_crs(gov)
    dis = dis.to_crs(metric_crs)
    gov = gov.to_crs(metric_crs)

    if GOV_GEO_KEY not in gov.columns:
        raise ValueError(f"{gov_path.name}: missing governorate key '{GOV_GEO_KEY}'")

    value_cols = _indicator_columns(dis, theme)
    if not value_cols:
        raise ValueError(f"{dis_path.name}: no numeric indicator columns found")

    plan = _aggregation_plan(value_cols)
    sum_cols = [col for col, method in plan.items() if method == "sum"]
    mean_cols = [col for col, method in plan.items() if method == "mean"]

    id_col = DIS_ID_KEY if DIS_ID_KEY in dis.columns else None
    keep_cols = value_cols + ["geometry"]
    if id_col:
        keep_cols.insert(0, id_col)
    dis_subset = dis[keep_cols].copy()
    gov_subset = gov[[GOV_GEO_KEY, "geometry"]].copy()

    intersection = gpd.overlay(dis_subset, gov_subset, how="intersection", keep_geom_type=False)
    intersection["__part_area"] = intersection.geometry.area

    if id_col is None:
        intersection["__district_id"] = intersection.index.astype(str)
        id_col = "__district_id"

    primary_idx = intersection.groupby(id_col)["__part_area"].idxmax()
    primary = intersection.loc[primary_idx].copy()

    aggregated_rows: list[dict] = []
    for gov_name, _ in gov_subset.groupby(GOV_GEO_KEY):
        aggregated_rows.append({GOV_GEO_KEY: gov_name})

    agg_df = pd.DataFrame(aggregated_rows)

    if sum_cols:
        sum_part = primary.groupby(GOV_GEO_KEY, as_index=False)[sum_cols].sum(min_count=1)
        agg_df = agg_df.merge(sum_part, on=GOV_GEO_KEY, how="left")

    if mean_cols:
        mean_rows: list[dict] = []
        for gov_name, group in intersection.groupby(GOV_GEO_KEY):
            total_area = float(group["__part_area"].sum())
            row: dict = {GOV_GEO_KEY: gov_name}
            if total_area <= 0:
                for col in mean_cols:
                    row[col] = None
            else:
                for col in mean_cols:
                    row[col] = float((group[col] * group["__part_area"]).sum() / total_area)
            mean_rows.append(row)
        mean_part = pd.DataFrame(mean_rows)
        agg_df = agg_df.merge(mean_part, on=GOV_GEO_KEY, how="left")

    gov_out = gov[[GOV_GEO_KEY, "geometry"]].merge(agg_df, on=GOV_GEO_KEY, how="left")
    gov_out = gpd.GeoDataFrame(gov_out, geometry="geometry", crs=gov.crs)

    composite_action = "none"
    if theme in COMPOSITE_THEMES:
        gov_out = _recompute_composite_score(gov_out)
        composite_action = "recomputed"
        plan["composite_score"] = composite_action

    method_log = "; ".join(f"{col}={plan[col]}" for col in (*value_cols, "composite_score") if col in plan)
    output_cols = value_cols + (["composite_score"] if theme in COMPOSITE_THEMES else [])

    return gov_out.to_crs("EPSG:4326"), {
        "theme": theme,
        "dis_file": dis_path.name,
        "gov_file": gov_path.name,
        "value_columns": ",".join(output_cols),
        "aggregation_methods": method_log,
        "sum_columns": ",".join(sum_cols),
        "mean_columns": ",".join(mean_cols),
        "composite_action": composite_action,
        "dis_features": len(dis),
        "gov_features": len(gov),
        "gov_with_values": int(agg_df[GOV_GEO_KEY].notna().sum()),
    }


def _to_geojson_dict(gdf: gpd.GeoDataFrame) -> dict:
    return json.loads(gdf.to_json())


def _extract_pillar_from_spatial_geojson(path: Path, theme: int) -> pd.DataFrame:
    gdf = gpd.read_file(path)
    df = pd.DataFrame(gdf.drop(columns="geometry"))
    if GOV_GEO_KEY not in df.columns:
        raise ValueError(f"{path.name}: missing governorate key '{GOV_GEO_KEY}'")
    df = df.rename(columns={GOV_GEO_KEY: GOV_ID_FOR_SCORING})
    metric_col = _find_metric_column(df, theme)
    if not metric_col:
        raise ValueError(f"{path.name}: no pillar metric found for theme {theme}")
    out_col = THEME_OUTPUT_COLUMN[theme]
    return df[[GOV_ID_FOR_SCORING, metric_col]].rename(columns={metric_col: out_col})


def _build_overall_geojson(gov_path: Path, scored_df: pd.DataFrame) -> gpd.GeoDataFrame:
    gov = gpd.read_file(gov_path)
    if gov.crs is None:
        gov = gov.set_crs("EPSG:4326")
    scores = scored_df[[GOV_ID_FOR_SCORING, "composite_score"]].rename(
        columns={
            GOV_ID_FOR_SCORING: GOV_GEO_KEY,
            "composite_score": OVERALL_GEOJSON_SCORE_FIELD,
        }
    )
    gov_out = gov[[GOV_GEO_KEY, "geometry"]].merge(scores, on=GOV_GEO_KEY, how="left")
    return gpd.GeoDataFrame(gov_out, geometry="geometry", crs=gov.crs)


def build_spatial_overall_vulnerability(
    spatial_outputs: dict[int, Path],
    gov_path: Path,
    out_dir: Path,
) -> dict:
    """Combine spatial GOV theme pillars into one overall vulnerability index + GeoJSON."""
    if not spatial_outputs:
        raise ValueError("No spatial theme outputs available for overall vulnerability.")

    available_themes = sorted(spatial_outputs)
    missing_themes = sorted(t for t in ALL_THEMES if t not in set(available_themes))
    if missing_themes:
        print(f"[Overall spatial] Missing themes skipped: {missing_themes}")

    merged_df: pd.DataFrame | None = None
    for theme in available_themes:
        frame = _extract_pillar_from_spatial_geojson(spatial_outputs[theme], theme)
        merged_df = frame if merged_df is None else merged_df.merge(
            frame, on=GOV_ID_FOR_SCORING, how="outer"
        )

    if merged_df is None:
        raise ValueError("No pillar metrics extracted from spatial theme GeoJSON files.")

    write_csv_unicode(merged_df, out_dir / SPATIAL_EXTRACTED_CSV, index=False)

    scored_df, weights_df, kendall_df = _build_overall_score("GOV", merged_df)
    write_csv_unicode(scored_df, out_dir / SPATIAL_OVERALL_INDEX_CSV, index=False)
    write_csv_unicode(weights_df, out_dir / SPATIAL_OVERALL_WEIGHTS_CSV, index=False)
    write_csv_unicode(kendall_df, out_dir / SPATIAL_OVERALL_KENDALL_CSV, index=True)

    overall_gdf = _build_overall_geojson(gov_path, scored_df)
    write_geojson_unicode(_to_geojson_dict(overall_gdf), out_dir / SPATIAL_OVERALL_GEOJSON)

    return {
        "action": "overall_spatial_scored",
        "available_themes": ",".join(map(str, available_themes)),
        "missing_themes": ",".join(map(str, missing_themes)),
        "output_rows": len(scored_df),
        "extracted_csv": SPATIAL_EXTRACTED_CSV,
        "overall_index_csv": SPATIAL_OVERALL_INDEX_CSV,
        "overall_geojson": SPATIAL_OVERALL_GEOJSON,
    }


def run_dis_to_gov_spatial() -> list[dict]:
    gov_path = _base_gov_geojson()
    if gov_path is None:
        raise ValueError("No GOV base GeoJSON found in GEOJSON/GOV")

    out_dir = gov_dis_spatial_aggregate_dir()
    out_dir.mkdir(parents=True, exist_ok=True)

    results: list[dict] = []
    errors: list[dict] = []
    method_rows: list[dict] = []
    spatial_outputs: dict[int, Path] = {}

    for theme in sorted(ALL_THEMES):
        dis_path = _find_joined_file_for_theme("DIS", theme)
        if dis_path is None:
            message = f"Theme {theme}: no DIS joined GeoJSON found in {joined_geojson_dir('DIS')}"
            print(message)
            errors.append({"theme": theme, "error": message})
            continue

        out_stem = _gov_output_stem(theme, dis_path)
        out_path = out_dir / f"{out_stem}__from_dis_spatial.geojson"
        try:
            gov_gdf, stats = aggregate_dis_to_gov(dis_path, gov_path, theme)
            write_geojson_unicode(_to_geojson_dict(gov_gdf), out_path)
            spatial_outputs[theme] = out_path
            record = {
                **stats,
                "output_geojson": str(out_path.relative_to(out_dir.parent.parent)),
            }
            results.append(record)
            for col in stats["value_columns"].split(","):
                if not col:
                    continue
                if col == "composite_score" and stats["composite_action"] != "none":
                    method = "recomputed"
                else:
                    method = aggregation_method_for_column(col)
                method_rows.append({
                    "theme": theme,
                    "dis_file": dis_path.name,
                    "indicator": col,
                    "method": method,
                })
            print(
                f"[T{theme}] Aggregated {dis_path.name} -> {out_path.name} "
                f"({stats['gov_with_values']}/{stats['gov_features']} governorates)"
            )
        except ValueError as exc:
            print(f"[T{theme}] Failed {dis_path.name}: {exc}")
            errors.append({"theme": theme, "dis_file": dis_path.name, "error": str(exc)})

    if spatial_outputs:
        try:
            overall_stats = build_spatial_overall_vulnerability(
                spatial_outputs, gov_path, out_dir
            )
            results.append(overall_stats)
            print(
                "[Overall spatial] Built GOV overall vulnerability from DIS-aggregated themes: "
                f"{overall_stats['overall_geojson']}"
            )
        except ValueError as exc:
            print(f"[Overall spatial] Failed: {exc}")
            errors.append({"theme": "overall", "error": str(exc)})

    report_dir = reports_dir()
    report_dir.mkdir(parents=True, exist_ok=True)
    if results:
        write_csv_unicode(
            pd.DataFrame(results),
            report_dir / "dis_to_gov_spatial_summary.csv",
            index=False,
        )
    if method_rows:
        write_csv_unicode(
            pd.DataFrame(method_rows),
            report_dir / "dis_to_gov_spatial_methods.csv",
            index=False,
        )
    if errors:
        write_csv_unicode(
            pd.DataFrame(errors),
            report_dir / "dis_to_gov_spatial_errors.csv",
            index=False,
        )

    return results


if __name__ == "__main__":
    run_dis_to_gov_spatial()
