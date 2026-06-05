"""
Build Comp_Index_All_ADM1_2_3.xlsx from the five composite-index GeoJSON layers
used in the map (per governorate / district / cadastre resolution).
"""
import json
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
OUTPUT_XLSX = DATA_DIR / "Comp_Index_All_ADM1_2_3.xlsx"

# Five composite pillars (map-linked files; service at GOV uses ADM1_SERVICE_STRESS — not on map).
LEVEL_CONFIG = {
    "GOV": {
        "join_on": ["CODE"],
        "admin_cols": ["CODE", "ADM1_NAME"],
        "files": [
            ("Displacement Pressure", "ADM1_Displacement Pressure.geojson"),
            ("Socioeconomic Vulnerability", "ADM1_ECONOMIC_VUL.geojson"),
            ("Tension and Conflict Risk", "sv_peace_adm1.geojson"),
            ("Demographic Shock Factor", "ADM1_Demographic_Shock_Factor.geojson"),
            ("Service & Infrastructure Vulnerability", "ADM1_SERVICE_STRESS.geojson"),
        ],
    },
    "DISTRICT": {
        "join_on": ["ADM2_NAME"],
        "admin_cols": ["ADM2_NAME"],
        "files": [
            ("Displacement Pressure", "ADM2_Displacement Pressure.geojson"),
            ("Socioeconomic Vulnerability", "ADM2_ECONOMIC_VUL.geojson"),
            ("Tension and Conflict Risk", "sv_peace_adm2.geojson"),
            ("Demographic Shock Factor", "ADM2_Demographic_Shock_Factor.geojson"),
            ("Service & Infrastructure Vulnerability", "ADM2_SERVICE_STRESS.geojson"),
        ],
    },
    "CAD": {
        "join_on": ["CODE"],
        "admin_cols": ["CODE", "ADM3_NAME", "ACS_CODE", "CODE_2", "CODE_2_int"],
        "files": [
            ("Displacement Pressure", "ADM3_Displacement Pressure.geojson", ["CODE"]),
            ("Socioeconomic Vulnerability", "ADM3_ECONOMIC_VUL.geojson", ["CODE"]),
            ("Tension and Conflict Risk", "TENSION_PEACE_CAD_MAY_04.geojson", ["CODE"]),
            ("Demographic Shock Factor", "ADM3_Demographic_Shock_Factor.geojson", ["CODE"]),
            (
                "Service & Infrastructure Vulnerability",
                "service_stress_infra_vul_adm3.geojson",
                ["ADM3_NAME"],
            ),
        ],
    },
}


def load_properties(path: Path) -> pd.DataFrame:
    with path.open(encoding="utf-8") as handle:
        geojson = json.load(handle)
    rows = [feature.get("properties") or {} for feature in geojson.get("features", [])]
    return pd.DataFrame(rows)


def normalize_join_columns(df: pd.DataFrame, join_on: list[str]) -> pd.DataFrame:
    out = df.copy()
    for key in join_on:
        if key in out.columns:
            out[key] = out[key].astype(str).str.strip()
    return out


def dedupe_on_keys(df: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
    present = [k for k in keys if k in df.columns]
    if not present:
        return df
    return df.drop_duplicates(subset=present, keep="first")


def prepare_index_frame(df: pd.DataFrame, index_label: str, join_on: list[str], admin_cols: list[str]) -> pd.DataFrame:
    reserved = set(join_on) | set(admin_cols)
    rename_map = {}
    for col in df.columns:
        if col in reserved:
            continue
        rename_map[col] = f"{index_label} | {col}"
    return df.rename(columns=rename_map)


def merge_level(level_name: str, config: dict) -> pd.DataFrame:
    join_on = config["join_on"]
    admin_cols = config["admin_cols"]
    merged = None

    file_entries = config["files"]
    for entry in file_entries:
        if len(entry) == 3:
            index_label, filename, file_join_on = entry
        else:
            index_label, filename = entry
            file_join_on = join_on

        path = DATA_DIR / filename
        if not path.exists():
            raise FileNotFoundError(f"Missing {level_name} layer file: {path}")

        frame = load_properties(path)
        frame = normalize_join_columns(frame, file_join_on)
        frame = dedupe_on_keys(frame, file_join_on)
        frame = prepare_index_frame(frame, index_label, file_join_on, admin_cols)

        if merged is None:
            merged = frame
            continue

        merge_keys = file_join_on
        overlap = [c for c in frame.columns if c in merged.columns and c not in merge_keys]
        frame = frame.drop(columns=overlap, errors="ignore")
        merged = merged.merge(frame, on=merge_keys, how="outer")

    for col in admin_cols:
        if col not in merged.columns:
            continue
        suffixed = [c for c in merged.columns if c.startswith(f"{col}_")]
        if suffixed:
            merged[col] = merged[col].combine_first(merged[suffixed[0]])
            merged = merged.drop(columns=suffixed)

    admin_present = [c for c in admin_cols if c in merged.columns]
    other_cols = sorted(c for c in merged.columns if c not in admin_present)
    return merged[admin_present + other_cols]


def main() -> None:
    with pd.ExcelWriter(OUTPUT_XLSX, engine="openpyxl") as writer:
        for level_name, config in LEVEL_CONFIG.items():
            sheet_df = merge_level(level_name, config)
            sheet_df.to_excel(writer, sheet_name=level_name, index=False)
            print(f"{level_name}: {len(sheet_df)} rows, {len(sheet_df.columns)} columns")

    print(f"Wrote {OUTPUT_XLSX}")


if __name__ == "__main__":
    main()
