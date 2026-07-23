"""
Batch-plot all Social Vulnerability maps used in the LB_DEV tool.

Creates:
  map_batch_exports/
    <theme>/
      gov|dis|cad/
        <individual labelled choropleths>.png
        _combined_all_maps.png   # one large sheet: overall + composite + sub-indicators
      (skips resolutions where the theme GeoJSON is unavailable)

Each theme uses a fixed white→dark colour ramp (matching the tool's theme palette).
Titles follow: "Composite score Theme N - <Title> + <Resolution>"

Dependencies: geopandas, matplotlib, numpy, pandas

Usage:
  python scripts/batch_plot_theme_maps.py
  python scripts/batch_plot_theme_maps.py --themes 1,6,overall --resolutions dis,gov
  python scripts/batch_plot_theme_maps.py --dpi 200 --out custom_folder
"""
from __future__ import annotations

import argparse
import math
import re
from pathlib import Path

import geopandas as gpd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.cm import ScalarMappable
from matplotlib.colors import LinearSegmentedColormap, Normalize

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DEFAULT_OUT = ROOT / "map_batch_exports"

RESOLUTIONS = ("gov", "dis", "cad")
RESOLUTION_LABEL = {
    "gov": "Governorate",
    "dis": "District",
    "cad": "Cadastre",
}

# White → dark ramps aligned with js/color_scales.js (theme fixedColorRamp)
THEME_COLORS: dict[str, list[str]] = {
    "overall": ["#ffffff", "#3b82f6", "#1e3a8a"],  # whiteToDarkBlue3
    "1": ["#ffffff", "#d8f2d8", "#9ed89e", "#4fae4f", "#0b5d1e"],  # green
    "2": ["#e6d9f2", "#8e5cbf", "#4a1f73"],  # purple3
    "3": ["#ffffff", "#dbeafe", "#93c5fd", "#3b82f6", "#1e3a8a"],  # blue
    "4": ["#ffffff", "#e6d9f2", "#c3a6e0", "#8e5cbf", "#4a1f73"],  # purple
    "5": ["#ffff33", "#fd8d3c", "#e31a1c"],  # yellowOrangeRed3
    "6": ["#ffffff", "#fecaca", "#f87171", "#dc2626", "#991b1b"],  # red
    "7": ["#ffffff", "#ffedd5", "#fdba74", "#f97316", "#c2410c"],  # orange
    "8": ["#ffffff", "#fce7f3", "#f9a8d4", "#ec4899", "#be185d"],  # pink
}

# Filenames match js/layer_controls.js JUNE17_FILES (under data/)
THEMES: dict[str, dict] = {
    "overall": {
        "number": None,
        "title": "Overall Vulnerability Index",
        "folder": "00_Overall_Vulnerability_Index",
        "score_field": "overall_vulnerability_score",
        "files": {
            "gov": "GOV_Overall_Vulnerability__from_dis_spatial.geojson",
            "dis": "DIS_Overall_Vulnerability.geojson",
            "cad": "CAD_Overall_Vulnerability.geojson",
        },
        "subindicators": [],  # overall has no sub-indicators in the tool
    },
    "1": {
        "number": 1,
        "title": "Displacement Pressure",
        "folder": "01_Theme_1_Displacement_Pressure",
        "score_field": "Displacement Ratio",
        "files": {
            "gov": "GOV Theme 1 - Displacement Pressure__from_dis_spatial.geojson",
            "dis": "DIS Theme 1 - Displacement Pressure__joined.geojson",
            "cad": "CAD Theme 1 - Displacement Pressure__joined.geojson",
        },
        "subindicators": [
            "Outside CS",
            "Inside CS",
            "Overall IDPs",
            "Population",
        ],
    },
    "2": {
        "number": 2,
        "title": "Tension and Conflict Risk",
        "folder": "02_Theme_2_Tension_and_Conflict_Risk",
        "score_field": "composite_score",
        "files": {
            "gov": "GOV Theme 2 - Tensions and Conflict Risk__from_dis_spatial.geojson",
            "dis": "DIS Theme 2 - Tensions and Conflict Risk__joined.geojson",
            "cad": "CAD Theme 2 - Tensions and Conflict Risk__joined.geojson",
        },
        "subindicators": [
            "Inter-sectarian and inter-communal conflict incidents",
            "Number of violent incidents",
            "Number of crime incidents",
            "Number of fatalities in tension incidents",
            "Fear of traveling within Lebanon safely",
            "Feeling lack of safety during the night",
        ],
    },
    "3": {
        "number": 3,
        "title": "Socioeconomic Vulnerability",
        "folder": "03_Theme_3_Socioeconomic_Vulnerability",
        "score_field": "composite_score",
        "files": {
            "gov": "GOV Theme 3 - Socioeconomic Vulnerability__from_dis_spatial.geojson",
            "dis": "DIS Theme 3 - Socioeconomic Vulnerability__joined.geojson",
            "cad": "CAD Theme 3 - Socioeconomic Vulnerability v2__joined.geojson",
        },
        "subindicators": [
            "Absolute Vulnerability",
            "Household Deprivation Score",
            "Nighttime light radiance",
        ],
    },
    "4": {
        "number": 4,
        "title": "Service & Infrastructure Vulnerability",
        "folder": "04_Theme_4_Service_and_Infrastructure_Vulnerability",
        "score_field": "composite_score",
        "files": {
            "gov": "GOV Theme 4 - Service & Infrastructure Vulnerability__from_dis_spatial.geojson",
            "dis": "DIS Theme 4 - Service & Infrastructure Vulnerability__joined.geojson",
            "cad": None,
        },
        "subindicators": [
            "Service-related incidents",
            "Perceptions on quality of services: Water",
            "Perceptions on quality of services: Electricity",
            "Perceptions on quality of services: Waste Removal",
            "Worry about access to healthcare services",
            "Worry about access to safe drinking water",
            "Water availability and accessibility",
            "Services as a tension driver",
            "Solid waste pressure (displacement)",
            "incidents around civil defence",
            "incidents around education",
            "incidents around electricity",
            "incidents around generator",
            "incidents around health",
            "quality of education",
            "quality of healthcare services",
            "quality of waste removal",
        ],
    },
    "5": {
        "number": 5,
        "title": "Demographic Tension / Stress",
        "folder": "05_Theme_5_Demographic_Tension_Stress",
        "score_field": "Demographic Factor",
        "files": {
            "gov": "GOV Theme 5 - Demographic Tension Stress__from_dis_spatial.geojson",
            "dis": "DIS Theme 5 - Demographic Tension Stress__joined.geojson",
            "cad": "CAD Theme 5 - Demographic Tension Stress__joined.geojson",
        },
        "subindicators": [
            "Resident Population",
            "Displaced Population",
            "Heterogeneity",
            "Displacement Ratio",
        ],
    },
    "6": {
        "number": 6,
        "title": "Climate and Environmental Risk",
        "folder": "06_Theme_6_Climate_and_Environmental_Risk",
        "score_field": "composite_score",
        "files": {
            "gov": "GOV Theme 6 - Climate and Environmental Risk__from_dis_spatial.geojson",
            "dis": "DIS Theme 6 - Climate Change and Environmental Risk__joined.geojson",
            "cad": "CAD Theme 6 - Climate Change and Environmental Risk__joined.geojson",
        },
        "subindicators": [
            "Mean annual hot days",
            "Forest fire risk",
            "Annual Dry Spell Length",
        ],
    },
    "7": {
        "number": 7,
        "title": "Political Vulnerability",
        "folder": "07_Theme_7_Political_Vulnerability",
        "score_field": "composite_score",
        "files": {
            "gov": "GOV Theme 7 - Political Vulnerability__from_dis_spatial.geojson",
            "dis": "DIS Theme 7 - Political Vulnerability__joined.geojson",
            "cad": None,
        },
        "subindicators": [
            "Municipal elections turnout",
            "Trust in Parliament",
            "Faith in politics",
            "Trust in LAF",
            "Faith in elections",
            "Trust in the court system",
            "Trust in security forces",
            "Municipal council entrenchment",
            "State Citizen Incidents ",  # trailing space is intentional (GeoJSON key)
            "Municipal authorities effect on quality of life: worsened life somewhat + alot",
            "LAF effect on quality of life: worsened life somewhat + alot",
            "ISF effect on quality of life: worsened life somewhat + alot",
        ],
    },
    "8": {
        "number": 8,
        "title": "Gender Based Vulnerabilities",
        "folder": "08_Theme_8_Gender_Based_Vulnerabilities",
        "score_field": "composite_score",
        "files": {
            "gov": "GOV Theme 8 - Gender Based Vulnerabilities__from_dis_spatial.geojson",
            "dis": "DIS Theme 8 - Gender Based Vulnerabilities__joined.geojson",
            "cad": None,
        },
        "subindicators": [
            "Reported incidents of gender-based violence",
            "Service access difficulty (female)",
            "Safety at night (female)",
            "Fear of movement or travel (female)",
            "Reports of harassment or violence",
            "Trust in the court system",
            "Female unemployment rate",
        ],
    },
}

OVERALL_FILES = THEMES["overall"]["files"]

METADATA_RE = re.compile(
    r"^(adm\d+_|acs_|cad_|rank$|composite_score_mean$|geometry$|_pillar_|__sv)",
    re.IGNORECASE,
)
METADATA_EXACT = {
    c.casefold()
    for c in (
        "ADM1_NAME",
        "ADM2_NAME",
        "ADM3_NAME",
        "adm1_name",
        "adm2_name",
        "adm3_name",
        "adm1_name1",
        "adm2_name1",
        "adm3_name1",
        "adm1_pcode",
        "adm2_pcode",
        "adm3_pcode",
        "ADM3_INT",
        "ACS_CODE",
        "ACS Code",
        "CODE",
        "CODE_NEW",
        "Dist Name",
        "_custom_composite",
    )
}


def slug(text: str, max_len: int = 120) -> str:
    s = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE)
    s = re.sub(r"[-\s]+", "_", s.strip())
    return (s[:max_len] or "layer").rstrip("_")


def is_metadata_col(name: str) -> bool:
    if not name or name == "geometry":
        return True
    if name.casefold() in METADATA_EXACT:
        return True
    return bool(METADATA_RE.search(name))


def make_cmap(hex_colors: list[str]) -> LinearSegmentedColormap:
    return LinearSegmentedColormap.from_list("theme_ramp", hex_colors, N=256)


def load_geojson(filename: str | None) -> gpd.GeoDataFrame | None:
    if not filename:
        return None
    path = DATA / filename
    if not path.exists():
        print(f"  missing: {path.name}")
        return None
    gdf = gpd.read_file(path)
    if gdf.crs is not None and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)
    return gdf


def resolve_field(gdf: gpd.GeoDataFrame, preferred: str) -> str | None:
    """Return preferred field, or a close match (strip trailing spaces)."""
    if preferred in gdf.columns:
        return preferred
    preferred_stripped = preferred.strip()
    for col in gdf.columns:
        if col.strip() == preferred_stripped:
            return col
    return None


def value_range(series: pd.Series, percentile: float = 98) -> tuple[float, float]:
    vals = pd.to_numeric(series, errors="coerce").dropna()
    if vals.empty:
        return 0.0, 1.0
    vmin = float(vals.min())
    vmax = float(np.nanpercentile(vals, percentile))
    if vmax <= vmin:
        vmax = float(vals.max())
    if vmax <= vmin:
        vmax = vmin + 1.0
    return vmin, vmax


def map_title(kind: str, theme_key: str, indicator_label: str, resolution: str) -> str:
    """
    Full title for standalone maps.
    kind: 'composite' | 'subindicator' | 'overall'
    """
    theme = THEMES[theme_key]
    res_label = RESOLUTION_LABEL[resolution]
    title = theme["title"]
    number = theme["number"]

    if kind == "overall":
        return f"Overall Vulnerability Index + {res_label}"
    if kind == "composite":
        if number is None:
            return f"Composite score - {title} + {res_label}"
        return f"Composite score Theme {number} - {title} + {res_label}"
    # sub-indicator
    if number is None:
        return f"{indicator_label} - {title} + {res_label}"
    return f"{indicator_label} Theme {number} - {title} + {res_label}"


def short_panel_title(kind: str, indicator_label: str = "") -> str:
    """
    Short subplot title for combined sheets (theme/resolution already in the main title).
    """
    if kind == "overall":
        return "Overall vulnerability"
    if kind == "composite":
        return "Composite score"
    return (indicator_label or "Sub-indicator").strip()


def discover_subindicators(
    gdf: gpd.GeoDataFrame,
    score_field: str,
    configured: list[str],
) -> list[tuple[str, str]]:
    """
    Return ordered list of (field_name_in_gdf, display_label).
    Prefer configured list (when present), then any other numeric columns.
    """
    found: list[tuple[str, str]] = []
    seen: set[str] = set()

    for label in configured:
        field = resolve_field(gdf, label)
        if field and field not in seen:
            series = pd.to_numeric(gdf[field], errors="coerce")
            if series.notna().sum() >= 2:
                found.append((field, label.strip() or field))
                seen.add(field)

    # Also pick up extra numeric fields present in the file
    score_resolved = resolve_field(gdf, score_field)
    for col in gdf.columns:
        if col == "geometry" or col in seen or is_metadata_col(col):
            continue
        if score_resolved and col == score_resolved:
            continue
        series = pd.to_numeric(gdf[col], errors="coerce")
        if series.notna().sum() >= 2:
            found.append((col, col.strip() or col))
            seen.add(col)

    return found


def plot_single_choropleth(
    gdf: gpd.GeoDataFrame,
    field: str,
    title: str,
    cmap: LinearSegmentedColormap,
    out_path: Path,
    *,
    dpi: int = 150,
    thin_boundaries: bool = False,
) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    plot_gdf = gdf.copy()
    plot_gdf["_v"] = pd.to_numeric(plot_gdf[field], errors="coerce")
    vmin, vmax = value_range(plot_gdf["_v"])
    lw = 0.04 if thin_boundaries else 0.25

    fig, ax = plt.subplots(figsize=(8, 9))
    ax.set_axis_off()
    ax.set_title(title, fontsize=11, fontweight="bold", pad=10)

    missing = plot_gdf[plot_gdf["_v"].isna()]
    if len(missing):
        missing.plot(ax=ax, color="#e5e7eb", edgecolor="#9ca3af", linewidth=lw)

    subset = plot_gdf[plot_gdf["_v"].notna()]
    if len(subset):
        subset.plot(
            ax=ax,
            column="_v",
            cmap=cmap,
            vmin=vmin,
            vmax=vmax,
            edgecolor="#4b5563",
            linewidth=lw,
            legend=False,
        )
    else:
        plot_gdf.boundary.plot(ax=ax, linewidth=lw, color="#9ca3af")
        ax.text(0.5, 0.5, "No numeric values", ha="center", va="center", transform=ax.transAxes)

    sm = ScalarMappable(norm=Normalize(vmin=vmin, vmax=vmax), cmap=cmap)
    sm.set_array([])
    cbar = fig.colorbar(sm, ax=ax, fraction=0.035, pad=0.02)
    cbar.ax.tick_params(labelsize=8)
    cbar.set_label(f"{vmin:.3g} – {vmax:.3g}", fontsize=8)

    fig.savefig(out_path, dpi=dpi, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return out_path


def plot_combined_sheet(
    panels: list[dict],
    sheet_title: str,
    out_path: Path,
    *,
    dpi: int = 150,
    thin_boundaries: bool = False,
) -> Path | None:
    """
    panels: list of {gdf, field, title, cmap}
    """
    if not panels:
        return None

    n = len(panels)
    ncols = min(4, n)
    nrows = math.ceil(n / ncols)
    fig_w = 4.2 * ncols
    fig_h = 4.6 * nrows + 0.6

    fig, axes = plt.subplots(nrows, ncols, figsize=(fig_w, fig_h))
    if n == 1:
        axes = np.array([axes])
    axes = np.atleast_1d(axes).ravel()

    fig.suptitle(sheet_title, fontsize=14, fontweight="bold", y=0.995)

    lw = 0.03 if thin_boundaries else 0.18
    for idx, panel in enumerate(panels):
        ax = axes[idx]
        ax.set_axis_off()
        ax.set_title(panel["title"], fontsize=8, fontweight="bold", pad=4)

        gdf = panel["gdf"]
        field = panel["field"]
        cmap = panel["cmap"]
        plot_gdf = gdf.copy()
        plot_gdf["_v"] = pd.to_numeric(plot_gdf[field], errors="coerce")
        vmin, vmax = value_range(plot_gdf["_v"])

        missing = plot_gdf[plot_gdf["_v"].isna()]
        if len(missing):
            missing.plot(ax=ax, color="#e5e7eb", edgecolor="#9ca3af", linewidth=lw)

        subset = plot_gdf[plot_gdf["_v"].notna()]
        if len(subset):
            subset.plot(
                ax=ax,
                column="_v",
                cmap=cmap,
                vmin=vmin,
                vmax=vmax,
                edgecolor="#4b5563",
                linewidth=lw,
                legend=False,
            )
            sm = ScalarMappable(norm=Normalize(vmin=vmin, vmax=vmax), cmap=cmap)
            sm.set_array([])
            cbar = fig.colorbar(sm, ax=ax, fraction=0.046, pad=0.02)
            cbar.ax.tick_params(labelsize=6)
        else:
            plot_gdf.boundary.plot(ax=ax, linewidth=lw, color="#9ca3af")
            ax.text(0.5, 0.5, "No data", ha="center", va="center", transform=ax.transAxes, fontsize=8)

    for idx in range(n, len(axes)):
        axes[idx].set_axis_off()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout(rect=[0, 0, 1, 0.98])
    fig.savefig(out_path, dpi=dpi, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return out_path


def export_theme_resolution(
    theme_key: str,
    resolution: str,
    out_root: Path,
    *,
    dpi: int,
    include_overall: bool,
    auto_discover: bool,
) -> int:
    theme = THEMES[theme_key]
    filename = theme["files"].get(resolution)
    if not filename:
        print(f"  skip {resolution}: not available for this theme")
        return 0

    gdf = load_geojson(filename)
    if gdf is None:
        return 0

    theme_cmap = make_cmap(THEME_COLORS[theme_key])
    overall_cmap = make_cmap(THEME_COLORS["overall"])
    thin = resolution == "cad"
    out_dir = out_root / theme["folder"] / resolution
    out_dir.mkdir(parents=True, exist_ok=True)

    panels: list[dict] = []
    saved = 0

    # 1) Overall vulnerability (context map in every theme folder)
    if include_overall and theme_key != "overall":
        overall_gdf = load_geojson(OVERALL_FILES.get(resolution))
        overall_field = resolve_field(overall_gdf, "overall_vulnerability_score") if overall_gdf is not None else None
        if overall_gdf is not None and overall_field:
            title = map_title("overall", theme_key, "Overall Vulnerability Index", resolution)
            path = out_dir / f"00_{slug(title)}.png"
            plot_single_choropleth(
                overall_gdf,
                overall_field,
                title,
                overall_cmap,
                path,
                dpi=dpi,
                thin_boundaries=thin,
            )
            panels.append(
                {
                    "gdf": overall_gdf,
                    "field": overall_field,
                    "title": short_panel_title("overall"),
                    "cmap": overall_cmap,
                }
            )
            saved += 1
            print(f"  saved {path.relative_to(out_root)}")

    # 2) Theme composite / primary score
    score_field = resolve_field(gdf, theme["score_field"])
    if score_field:
        title = map_title("composite", theme_key, theme["title"], resolution)
        path = out_dir / f"01_{slug(title)}.png"
        plot_single_choropleth(
            gdf,
            score_field,
            title,
            theme_cmap,
            path,
            dpi=dpi,
            thin_boundaries=thin,
        )
        panels.append(
            {
                "gdf": gdf,
                "field": score_field,
                "title": short_panel_title("composite"),
                "cmap": theme_cmap,
            }
        )
        saved += 1
        print(f"  saved {path.relative_to(out_root)}")
    else:
        print(f"  warning: score field '{theme['score_field']}' not in {filename}")

    # 3) Sub-indicators
    if theme_key == "overall":
        sub_list: list[tuple[str, str]] = []
    elif auto_discover:
        sub_list = discover_subindicators(gdf, theme["score_field"], theme["subindicators"])
    else:
        sub_list = []
        for label in theme["subindicators"]:
            field = resolve_field(gdf, label)
            if field:
                series = pd.to_numeric(gdf[field], errors="coerce")
                if series.notna().sum() >= 2:
                    sub_list.append((field, label.strip() or field))

    for i, (field, label) in enumerate(sub_list, start=1):
        title = map_title("subindicator", theme_key, label, resolution)
        path = out_dir / f"{i + 1:02d}_{slug(title)}.png"
        plot_single_choropleth(
            gdf,
            field,
            title,
            theme_cmap,
            path,
            dpi=dpi,
            thin_boundaries=thin,
        )
        panels.append(
            {
                "gdf": gdf,
                "field": field,
                "title": short_panel_title("subindicator", label),
                "cmap": theme_cmap,
            }
        )
        saved += 1
        print(f"  saved {path.relative_to(out_root)}")

    # 4) Combined sheet for this theme × resolution
    if panels:
        number = theme["number"]
        if number is None:
            sheet_title = f"{theme['title']} — all maps · {RESOLUTION_LABEL[resolution]}"
        else:
            sheet_title = (
                f"Theme {number} - {theme['title']} — "
                f"overall + composite + sub-indicators · {RESOLUTION_LABEL[resolution]}"
            )
        combined_path = out_dir / f"_combined_Theme_{number or 'Overall'}_{RESOLUTION_LABEL[resolution]}.png"
        # Sanitize filename
        combined_path = out_dir / f"_combined_{slug(sheet_title, 100)}.png"
        plot_combined_sheet(
            panels,
            sheet_title,
            combined_path,
            dpi=dpi,
            thin_boundaries=thin,
        )
        saved += 1
        print(f"  saved {combined_path.relative_to(out_root)}")

    return saved


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Batch-plot all LB_DEV theme maps.")
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Output root folder (default: {DEFAULT_OUT})",
    )
    parser.add_argument(
        "--themes",
        type=str,
        default="all",
        help="Comma-separated theme keys: overall,1,2,...,8 or 'all'",
    )
    parser.add_argument(
        "--resolutions",
        type=str,
        default="gov,dis,cad",
        help="Comma-separated: gov,dis,cad",
    )
    parser.add_argument("--dpi", type=int, default=150, help="PNG resolution (default 150)")
    parser.add_argument(
        "--no-overall-in-themes",
        action="store_true",
        help="Do not include Overall Vulnerability maps inside each theme folder",
    )
    parser.add_argument(
        "--configured-only",
        action="store_true",
        help="Only plot configured sub-indicators (skip auto-discovered extra fields)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    out_root: Path = args.out
    out_root.mkdir(parents=True, exist_ok=True)

    if args.themes.strip().lower() == "all":
        theme_keys = list(THEMES.keys())
    else:
        theme_keys = [t.strip() for t in args.themes.split(",") if t.strip()]
        unknown = [t for t in theme_keys if t not in THEMES]
        if unknown:
            raise SystemExit(f"Unknown theme keys: {unknown}. Valid: {list(THEMES)}")

    resolutions = [r.strip().lower() for r in args.resolutions.split(",") if r.strip()]
    for r in resolutions:
        if r not in RESOLUTIONS:
            raise SystemExit(f"Unknown resolution '{r}'. Valid: {list(RESOLUTIONS)}")

    print(f"Data:   {DATA}")
    print(f"Output: {out_root}")
    print(f"Themes: {theme_keys}")
    print(f"Resolutions: {resolutions}")

    total = 0
    for theme_key in theme_keys:
        theme = THEMES[theme_key]
        print(f"\n=== {theme['folder']} ===")
        for resolution in resolutions:
            print(f"-- {RESOLUTION_LABEL[resolution]} --")
            total += export_theme_resolution(
                theme_key,
                resolution,
                out_root,
                dpi=args.dpi,
                include_overall=not args.no_overall_in_themes,
                auto_discover=not args.configured_only,
            )

    print(f"\nDone. Wrote {total} PNG files under {out_root}")


if __name__ == "__main__":
    main()
