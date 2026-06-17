"""
Move unused map layer GeoJSON files from data/ to data/_archive_unused_layers/.

Keeps files referenced by js/layer_controls.js, js/main.js, js/admin_labels.js,
and scripts/export_map_composite_scores.py.
"""
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
ARCHIVE = DATA / "_archive_unused_layers"

# Basenames still used by the live map tool or export scripts.
KEEP_GEOJSON = {
    "adm1_summary_stats_1.geojson",
    "adm2_summary_stats_3.geojson",
    "adm3_summary_stats_1.geojson",
    "CAD_OVERALL_VUL_JUNE_16.geojson",
    "ADM3_Displacement_Pressure_June_11.geojson",
    "sv_socio_adm2.geojson",
    "sv_peace_adm2.geojson",
    "ADM3_T5_Demgraphic_Tension_Stress_June_11.geojson",
    "lbn_Roads Status_2026-03-18.geojson",
    "TTF_HOTSPOTS_ADM3.geojson",
    "ADM3_POP.geojson",
    "cadastre_join_ntl_night_safety_vul7_v2.geojson",
    "DHS_stats.geojson",
    "CS_DATA_09_03_26_full.geojson",
    "CS_DATA_10_03_26_full.geojson",
    "combined_cs_status.geojson",
    "DIS_OVERALL_VUL_JUNE_16.geojson",
    "ADM2_Displacement_Pressure_June_11.geojson",
    "NEW_ADM2_DIS Theme 3 - Socioeconomic Vulnerability _June_14_v4.geojson",
    "NEW_ADM2_DIS Theme 2 - Tensions and Conflict Risk _June_15.geojson",
    "NEW_ADM2_DIS Theme 4 - Service and Infrastructure Vulnerability _June_14.geojson",
    "NEW_ADM2_DIS Theme 2 - Demographic Tension Stress _June_15.geojson",
    "CAD Theme 3 - Socioeconomic Vulnerability June 16.geojson",
    "CAD Theme 2 - Tensions and Conflict Risk June 16.geojson",
    "NEW_ADM3_CAD Theme 4 - Service and Infrastructure Stress_June_15.geojson",
    "GOV_OVERALL_VUL_JUNE_16.geojson",
    "ADM1_Displacement_Pressure_June_14.geojson",
    "ADM1_GOV_Theme_3_Socioeconomic_Vulnerability_June_14.geojson",
    "NEW_ADM1_GOV Theme 2 - Tensions and Conflict Risk_June_14.geojson",
    "NEW_ADM1_DIS Theme 4 - Service and Infrastructure Vulnerability _June_14.geojson",
    "ADM1_Demographic_Shock_Factor.geojson",
    "ADM1_POP.geojson",
    "ADM2_POP.geojson",
    "cutline_adm2_district.geojson",
}


def move_path(src: Path, dest_root: Path) -> None:
    rel = src.relative_to(DATA)
    dest = dest_root / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        raise FileExistsError(f"Archive already contains {rel}")
    shutil.move(str(src), str(dest))
    print(f"  moved {rel}")


def main() -> None:
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    moved: list[str] = []

    for geojson in sorted(DATA.glob("*.geojson")):
        if geojson.name in KEEP_GEOJSON:
            continue
        move_path(geojson, ARCHIVE)
        moved.append(geojson.name)
        qmd = geojson.with_suffix(".qmd")
        if qmd.exists():
            move_path(qmd, ARCHIVE)

    old_layers = DATA / "Old_ADM2_1_layers"
    if old_layers.is_dir():
        dest_old = ARCHIVE / "Old_ADM2_1_layers"
        if dest_old.exists():
            for item in old_layers.rglob("*"):
                if item.is_file():
                    rel = item.relative_to(old_layers)
                    target = dest_old / rel
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(item), str(target))
            old_layers.rmdir()
        else:
            shutil.move(str(old_layers), str(dest_old))
        print("  moved Old_ADM2_1_layers/")

    manifest = ARCHIVE / "README.txt"
    manifest.write_text(
        "Unused map layer GeoJSON files archived from data/.\n"
        "Safe to delete later if confirmed not needed.\n\n"
        "Kept in data/ (active map layers):\n"
        + "\n".join(f"  - {name}" for name in sorted(KEEP_GEOJSON))
        + "\n\nMoved files:\n"
        + "\n".join(f"  - {name}" for name in moved)
        + "\n",
        encoding="utf-8",
    )
    print(f"\nArchived {len(moved)} geojson files -> {ARCHIVE}")
    print(f"Manifest: {manifest}")


if __name__ == "__main__":
    main()
