"""
Quick side-by-side choropleth comparisons: Governorate | District | Cadastre
for each of the 5 map themes (composite + numeric sub-indicators).

Output: side-by-side comparisons/*.png
"""
from __future__ import annotations

import re
from pathlib import Path

import geopandas as gpd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap, Normalize
from matplotlib.cm import ScalarMappable

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
JUNE17 = DATA / "June17"
OUT = ROOT / "side-by-side comparisons"

LEVELS = ("governorate", "district", "cadastre")
LEVEL_TITLES = {"governorate": "Governorate", "district": "District", "cadastre": "Cadastre"}

# Same layers / score fields as js/layer_controls.js (SV_RESOLUTION_CONFIG)
THEME_LAYERS = {
    "Displacement Pressure": {
        "governorate": ("GOV Theme 1 - Displacement Pressure__from_dis_spatial.geojson", "Displacement Ratio"),
        "district": ("DIS Theme 1 - Displacement Pressure__joined.geojson", "Displacement Ratio"),
        "cadastre": ("CAD Theme 1 - Displacement Pressure__joined.geojson", "Displacement Ratio"),
    },
    "Socioeconomic Vulnerability": {
        "governorate": (
            "GOV Theme 3 - Socioeconomic Vulnerability__from_dis_spatial.geojson",
            "composite_score",
        ),
        "district": (
            "DIS Theme 3 - Socioeconomic Vulnerability__joined.geojson",
            "composite_score",
        ),
        "cadastre": (
            "CAD Theme 3 - Socioeconomic Vulnerability__joined.geojson",
            "composite_score",
        ),
    },
    "Tension and Conflict Risk": {
        "governorate": (
            "GOV Theme 2 - Tensions and Conflict Risk__from_dis_spatial.geojson",
            "composite_score",
        ),
        "district": (
            "DIS Theme 2 - Tensions and Conflict Risk__joined.geojson",
            "composite_score",
        ),
        "cadastre": (
            "CAD Theme 2 - Tensions and Conflict Risk__joined.geojson",
            "composite_score",
        ),
    },
    "Service and Infrastructure Vulnerability": {
        "governorate": (
            "GOV Theme 4 - Service & Infrastructure Vulnerability__from_dis_spatial.geojson",
            "composite_score",
        ),
        "district": (
            "DIS Theme 4 - Service & Infrastructure Vulnerability__joined.geojson",
            "composite_score",
        ),
        "cadastre": (None, "composite_score"),
    },
    "Demographic Tension and Stress": {
        "governorate": (
            "GOV Theme 5- Demographic Tension Stress__from_dis_spatial.geojson",
            "Demographic Factor",
        ),
        "district": (
            "DIS Theme 5 - Demographic Tension Stress__joined.geojson",
            "Demographic Factor",
        ),
        "cadastre": ("CAD Theme 5 - Demographic Tension Stress__joined.geojson", "Demographic Factor"),
    },
}

METADATA_RE = re.compile(
    r"^(adm\d+_|acs_|cad_|rank$|composite_score_mean$|geometry$)",
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
    )
}


def slug(text: str) -> str:
    s = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE)
    s = re.sub(r"[-\s]+", "_", s.strip())
    return s[:180] or "layer"


def is_metadata_col(name: str) -> bool:
    if not name or name == "geometry":
        return True
    if name.casefold() in METADATA_EXACT:
        return True
    return bool(METADATA_RE.search(name))


def load_layer(filename: str | None) -> gpd.GeoDataFrame | None:
    if not filename:
        return None
    path = JUNE17 / filename
    if not path.exists():
        print(f"  missing: {path.name}")
        return None
    gdf = gpd.read_file(path)
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)
    return gdf


def numeric_columns(gdf: gpd.GeoDataFrame, exclude: set[str]) -> list[str]:
    cols = []
    for col in gdf.columns:
        if col == "geometry" or col in exclude or is_metadata_col(col):
            continue
        series = pd.to_numeric(gdf[col], errors="coerce")
        if series.notna().sum() >= 2:
            cols.append(col)
    return sorted(cols)


def series_for_field(gdf: gpd.GeoDataFrame | None, field: str) -> pd.Series | None:
    if gdf is None or field not in gdf.columns:
        return None
    return pd.to_numeric(gdf[field], errors="coerce")


def level_value_range(
    gdf: gpd.GeoDataFrame | None,
    field: str,
    *,
    percentile: float = 98,
) -> tuple[float, float]:
    """Min/max for one admin level (independent scale per resolution)."""
    s = series_for_field(gdf, field)
    if s is None:
        return 0.0, 1.0
    vals = s.dropna()
    if vals.empty:
        return 0.0, 1.0
    vmin = float(vals.min())
    vmax = float(np.nanpercentile(vals, percentile))
    if vmax <= vmin:
        vmax = float(vals.max())
    if vmax <= vmin:
        vmax = vmin + 1.0
    if vmin > 0:
        vmin = 0.0
    return vmin, vmax


def plot_side_by_side(
    theme: str,
    indicator_label: str,
    fields_by_level: dict[str, str],
    level_gdfs: dict[str, gpd.GeoDataFrame | None],
    *,
    is_composite: bool = False,
) -> None:
    cmap = make_cmap()

    fig = plt.figure(figsize=(16, 6.5))
    gs = fig.add_gridspec(2, 3, height_ratios=[1, 0.07], hspace=0.22, wspace=0.08)
    map_axes = [fig.add_subplot(gs[0, i]) for i in range(3)]
    cbar_axes = [fig.add_subplot(gs[1, i]) for i in range(3)]

    fig.suptitle(
        f"{theme}\n{indicator_label}" + (" (composite)" if is_composite else ""),
        fontsize=13,
        fontweight="bold",
        y=0.98,
    )

    for map_ax, cbar_ax, level in zip(map_axes, cbar_axes, LEVELS):
        gdf = level_gdfs.get(level)
        field = fields_by_level.get(level)
        map_ax.set_title(LEVEL_TITLES[level], fontsize=11, pad=6)
        map_ax.set_axis_off()

        if gdf is None:
            map_ax.text(0.5, 0.5, "Layer missing", ha="center", va="center", transform=map_ax.transAxes)
            cbar_ax.set_axis_off()
            continue

        if not field or field not in gdf.columns:
            gdf.boundary.plot(ax=map_ax, linewidth=0.3, color="#999999")
            map_ax.text(0.5, 0.5, "Field not in layer", ha="center", va="center", transform=map_ax.transAxes)
            cbar_ax.set_axis_off()
            continue

        vmin, vmax = level_value_range(gdf, field)
        plot_gdf = gdf.copy()
        plot_gdf["_v"] = pd.to_numeric(plot_gdf[field], errors="coerce")
        lw = 0.05 if level == "cadastre" else 0.2

        missing = plot_gdf[plot_gdf["_v"].isna()]
        if len(missing):
            missing.plot(ax=map_ax, color="#e5e7eb", edgecolor="#666666", linewidth=lw)
        subset = plot_gdf[plot_gdf["_v"].notna()]
        if len(subset):
            subset.plot(
                ax=map_ax,
                column="_v",
                cmap=cmap,
                vmin=vmin,
                vmax=vmax,
                edgecolor="#555555",
                linewidth=lw,
                legend=False,
            )
        elif len(plot_gdf):
            plot_gdf.boundary.plot(ax=map_ax, linewidth=lw, color="#999999")

        norm = Normalize(vmin=vmin, vmax=vmax)
        cbar = fig.colorbar(
            ScalarMappable(norm=norm, cmap=cmap),
            cax=cbar_ax,
            orientation="horizontal",
        )
        cbar.ax.tick_params(labelsize=7)
        cbar.set_label(
            f"{LEVEL_TITLES[level]} range: {vmin:.3g} – {vmax:.3g}",
            fontsize=7,
        )

    suffix = "composite" if is_composite else slug(indicator_label)
    out_path = OUT / f"{slug(theme)}__{suffix}.png"
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  saved {out_path.name}")


def make_cmap():
    return LinearSegmentedColormap.from_list(
        "white_red",
        ["#ffffff", "#fee0d2", "#fc9272", "#ef3b2c", "#cb181d", "#67000d"],
        N=256,
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    cmap_preview = make_cmap()
    print(f"Output folder: {OUT}")

    for theme, level_files in THEME_LAYERS.items():
        print(f"\n=== {theme} ===")
        level_gdfs: dict[str, gpd.GeoDataFrame | None] = {}

        for level in LEVELS:
            filename, _composite_field = level_files[level]
            level_gdfs[level] = load_layer(filename)

        if not any(gdf is not None for gdf in level_gdfs.values()):
            continue

        composite_fields = {lv: level_files[lv][1] for lv in LEVELS}
        plot_side_by_side(
            theme,
            "Composite score",
            composite_fields,
            level_gdfs,
            is_composite=True,
        )

        exclude = set(composite_fields.values())
        indicator_fields: set[str] = set()
        for gdf in level_gdfs.values():
            if gdf is not None:
                indicator_fields.update(numeric_columns(gdf, exclude))

        for field in sorted(indicator_fields):
            plot_side_by_side(
                theme,
                field,
                {lv: field for lv in LEVELS},
                level_gdfs,
                is_composite=False,
            )

    # tiny palette reference
    fig, ax = plt.subplots(figsize=(6, 0.6))
    gradient = np.linspace(0, 1, 256).reshape(1, -1)
    ax.imshow(gradient, aspect="auto", cmap=cmap_preview)
    ax.set_axis_off()
    ax.set_title("Color scale: white (low) → red (high); each panel uses its own min–max range", fontsize=10)
    fig.savefig(OUT / "_color_scale_reference.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("\nDone.")


if __name__ == "__main__":
    main()
