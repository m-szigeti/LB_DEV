"""
Export map-display composite scores for all five themes at GOV / DISTRICT / CADASTRE.

Uses the same GeoJSON files and score attributes as js/layer_controls.js (SV_RESOLUTION_CONFIG).
Output: data/Map_Composite_Scores_By_Admin_Level.xlsx
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
JUNE17_DIR = DATA_DIR / "June17"
OUTPUT_XLSX = DATA_DIR / "Map_Composite_Scores_By_Admin_Level.xlsx"
OUTPUT_DISTRICT_CSV = DATA_DIR / "District_Theme_Composite_Scores.csv"
OUTPUT_GOVERNORATE_CSV = DATA_DIR / "Governorate_Theme_Composite_Scores.csv"

THEME_COLUMNS = [
    "Displacement Pressure",
    "Socioeconomic Vulnerability",
    "Tension and Conflict Risk",
    "Service & Infrastructure Vulnerability",
    "Demographic Tension / Stress",
]

# Demographic governorate layer uses alternate spellings vs the other ADM1 layers.
GOV_NAME_ALIASES = {
    "baalbek-hermel": "Baalbek-El Hermel",
    "baalbek-el hermel": "Baalbek-El Hermel",
    "beyrouth": "Beirut",
    "beirut": "Beirut",
    "nabatiye": "El Nabatieh",
    "el nabatieh": "El Nabatieh",
}

ADM2_CROSSWALK = DATA_DIR / "ntl_joins" / "adm2.csv"

ADMIN_OUTPUT_COLS = {
    "Governorate": ["ADM1_NAME"],
    "District": ["ADM1_NAME", "ADM2_NAME"],
    "Cadastre": ["ACS_CODE", "ADM3_NAME"],
}

# (theme label, filename under data/June17, score attribute used on map)
LEVEL_THEMES = {
    "Governorate": [
        (
            "Displacement Pressure",
            "GOV Theme 1 - Displacement Pressure__from_dis_spatial.geojson",
            "Displacement Ratio",
        ),
        (
            "Socioeconomic Vulnerability",
            "GOV Theme 3 - Socioeconomic Vulnerability__from_dis_spatial.geojson",
            "composite_score",
        ),
        (
            "Tension and Conflict Risk",
            "GOV Theme 2 - Tensions and Conflict Risk__from_dis_spatial.geojson",
            "composite_score",
        ),
        (
            "Service & Infrastructure Vulnerability",
            "GOV Theme 4 - Service & Infrastructure Vulnerability__from_dis_spatial.geojson",
            "composite_score",
        ),
        (
            "Demographic Tension / Stress",
            "GOV Theme 5- Demographic Tension Stress__from_dis_spatial.geojson",
            "Demographic Factor",
        ),
    ],
    "District": [
        (
            "Displacement Pressure",
            "DIS Theme 1 - Displacement Pressure__joined.geojson",
            "Displacement Ratio",
        ),
        (
            "Socioeconomic Vulnerability",
            "DIS Theme 3 - Socioeconomic Vulnerability__joined.geojson",
            "composite_score",
        ),
        (
            "Tension and Conflict Risk",
            "DIS Theme 2 - Tensions and Conflict Risk__joined.geojson",
            "composite_score",
        ),
        (
            "Service & Infrastructure Vulnerability",
            "DIS Theme 4 - Service & Infrastructure Vulnerability__joined.geojson",
            "composite_score",
        ),
        (
            "Demographic Tension / Stress",
            "DIS Theme 5 - Demographic Tension Stress__joined.geojson",
            "Demographic Factor",
        ),
    ],
    "Cadastre": [
        (
            "Displacement Pressure",
            "CAD Theme 1 - Displacement Pressure__joined.geojson",
            "Displacement Ratio",
        ),
        (
            "Socioeconomic Vulnerability",
            "CAD Theme 3 - Socioeconomic Vulnerability__joined.geojson",
            "composite_score",
        ),
        (
            "Tension and Conflict Risk",
            "CAD Theme 2 - Tensions and Conflict Risk__joined.geojson",
            "composite_score",
        ),
        (
            "Service & Infrastructure Vulnerability",
            None,
            "composite_score",
        ),
        (
            "Demographic Tension / Stress",
            "CAD Theme 5 - Demographic Tension Stress__joined.geojson",
            "Demographic Factor",
        ),
    ],
}


def load_geojson(path: Path) -> pd.DataFrame:
    with path.open(encoding="utf-8") as handle:
        geojson = json.load(handle)
    rows = [feature.get("properties") or {} for feature in geojson.get("features", [])]
    return pd.DataFrame(rows)


def first_present(row: pd.Series, *candidates: str):
    for key in candidates:
        if key in row.index and pd.notna(row[key]) and str(row[key]).strip() != "":
            return row[key]
    return None


def canonical_gov_name(name) -> str | None:
    if name is None or (isinstance(name, float) and pd.isna(name)):
        return None
    text = str(name).strip()
    if not text:
        return None
    return GOV_NAME_ALIASES.get(text.casefold(), text)


def cadastre_match_keys(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    out["_pcode"] = (
        out.apply(lambda r: first_present(r, "adm3_pcode", "ADM3_INT"), axis=1)
        .astype(str)
        .str.strip()
    )
    out["_name"] = out.apply(
        lambda r: first_present(r, "ADM3_NAME", "adm3_name", "adm3_name1"), axis=1
    )
    ranked = out.sort_values(["_pcode"], kind="stable")
    ranked["_rank"] = ranked.groupby("_pcode", sort=False).cumcount()
    out.loc[ranked.index, "_rank"] = ranked["_rank"]
    return out


def build_cadastre_sheet() -> pd.DataFrame:
    admin_cols = ADMIN_OUTPUT_COLS["Cadastre"]
    master_label, master_file, master_attr = LEVEL_THEMES["Cadastre"][0]
    master = cadastre_match_keys(load_geojson(JUNE17_DIR / master_file))
    master = master.rename(columns={master_attr: master_label})
    master["ADM3_NAME"] = master.apply(
        lambda r: first_present(r, "ADM3_NAME", "adm3_name", "adm3_name1"), axis=1
    )
    master["ACS_CODE"] = master.apply(
        lambda r: first_present(r, "ACS_CODE", "ACS Code"), axis=1
    )

    merged = master[
        ["_pcode", "_rank", "ADM3_NAME", "ACS_CODE", master_label]
    ].copy()

    for theme_label, filename, score_attr in LEVEL_THEMES["Cadastre"][1:]:
        if not filename:
            merged[theme_label] = pd.NA
            continue
        path = JUNE17_DIR / filename
        if not path.exists():
            merged[theme_label] = pd.NA
            continue
        frame = cadastre_match_keys(load_geojson(path))
        if score_attr not in frame.columns:
            raise KeyError(f"{path.name} missing score field '{score_attr}'")

        slim = frame[["_pcode", "_rank", score_attr]].rename(
            columns={score_attr: theme_label}
        )
        slim = slim.drop_duplicates(subset=["_pcode", "_rank"], keep="first")
        merged = merged.merge(slim, on=["_pcode", "_rank"], how="left")

        if theme_label == "Demographic Tension / Stress":
            frame["ACS_CODE"] = frame.apply(
                lambda r: first_present(r, "ACS_CODE", "ACS Code"), axis=1
            )
            acs = frame[["_pcode", "_rank", "ACS_CODE"]].drop_duplicates(
                subset=["_pcode", "_rank"], keep="first"
            )
            acs = acs.rename(columns={"ACS_CODE": "_acs"})
            merged = merged.merge(acs, on=["_pcode", "_rank"], how="left")
            merged["ACS_CODE"] = merged["ACS_CODE"].combine_first(merged["_acs"])
            merged = merged.drop(columns=["_acs"])

    ordered = admin_cols + [c for c in THEME_COLUMNS if c in merged.columns]
    return merged[ordered].sort_values(by=admin_cols, kind="stable").reset_index(drop=True)


def normalize_gov(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["ADM1_NAME"] = out.apply(
        lambda r: canonical_gov_name(
            first_present(r, "ADM1_NAME", "adm1_name", "adm1_name1")
        ),
        axis=1,
    )
    out["_join"] = out["ADM1_NAME"]
    return out


def normalize_district(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["ADM2_NAME"] = out.apply(
        lambda r: first_present(r, "ADM2_NAME", "adm2_name", "adm2_name1"), axis=1
    )
    out["ADM1_NAME"] = out.apply(
        lambda r: first_present(r, "ADM1_NAME", "adm1_name", "adm1_name1"), axis=1
    )
    out["_join"] = out["ADM2_NAME"].astype(str).str.strip()
    return out


NORMALIZERS = {
    "Governorate": normalize_gov,
    "District": normalize_district,
}


def build_level_sheet(level_name: str) -> pd.DataFrame:
    if level_name == "Cadastre":
        return build_cadastre_sheet()

    normalize = NORMALIZERS[level_name]
    admin_cols = ADMIN_OUTPUT_COLS[level_name]
    merged: pd.DataFrame | None = None

    for theme_label, filename, score_attr in LEVEL_THEMES[level_name]:
        if not filename:
            continue
        path = JUNE17_DIR / filename
        if not path.exists():
            raise FileNotFoundError(f"Missing {level_name} layer: {path}")

        frame = normalize(load_geojson(path))
        if score_attr not in frame.columns:
            raise KeyError(f"{path.name} missing score field '{score_attr}'")

        slim = frame[["_join", *admin_cols, score_attr]].copy()
        slim = slim.rename(columns={score_attr: theme_label})
        if slim["_join"].duplicated().any():
            slim = slim.drop_duplicates(subset=["_join"], keep="first")

        if merged is None:
            merged = slim
            continue

        merged = merged.merge(slim, on="_join", how="outer", suffixes=("", "__new"))
        for col in admin_cols + [theme_label]:
            new_col = f"{col}__new"
            if new_col in merged.columns:
                if col in merged.columns:
                    merged[col] = merged[col].combine_first(merged[new_col])
                else:
                    merged[col] = merged[new_col]
                merged = merged.drop(columns=[new_col])

    assert merged is not None
    merged = merged.drop(columns=["_join"], errors="ignore")

    if level_name == "District" and ADM2_CROSSWALK.exists():
        crosswalk = pd.read_csv(ADM2_CROSSWALK, usecols=["adm2_name", "adm1_name"])
        crosswalk = crosswalk.rename(
            columns={"adm2_name": "ADM2_NAME", "adm1_name": "ADM1_NAME"}
        )
        crosswalk["ADM1_NAME"] = crosswalk["ADM1_NAME"].map(canonical_gov_name)
        crosswalk = crosswalk.drop_duplicates(subset=["ADM2_NAME"], keep="first")
        merged = merged.merge(crosswalk, on="ADM2_NAME", how="left", suffixes=("", "_xwalk"))
        merged["ADM1_NAME"] = merged["ADM1_NAME"].combine_first(merged["ADM1_NAME_xwalk"])
        merged = merged.drop(columns=["ADM1_NAME_xwalk"], errors="ignore")

    ordered = admin_cols + [c for c in THEME_COLUMNS if c in merged.columns]
    return merged[ordered].sort_values(by=admin_cols, kind="stable").reset_index(drop=True)


def build_district_theme_csv() -> pd.DataFrame:
    """District themes 1–5 with ADM2_Name for external merges."""
    sheet = build_level_sheet("District")
    out = sheet.rename(columns={"ADM2_NAME": "ADM2_Name"})
    cols = ["ADM2_Name"] + [c for c in THEME_COLUMNS if c in out.columns]
    return out[cols]


def build_governorate_theme_csv() -> pd.DataFrame:
    """Governorate themes 1–5 with ADM1_Name for external merges."""
    sheet = build_level_sheet("Governorate")
    out = sheet.rename(columns={"ADM1_NAME": "ADM1_Name"})
    cols = ["ADM1_Name"] + [c for c in THEME_COLUMNS if c in out.columns]
    return out[cols]


def main() -> None:
    governorate_csv = build_governorate_theme_csv()
    governorate_csv.to_csv(OUTPUT_GOVERNORATE_CSV, index=False)
    print(f"Governorate CSV: {len(governorate_csv)} rows -> {OUTPUT_GOVERNORATE_CSV}")

    district_csv = build_district_theme_csv()
    district_csv.to_csv(OUTPUT_DISTRICT_CSV, index=False)
    print(f"District CSV: {len(district_csv)} rows -> {OUTPUT_DISTRICT_CSV}")

    with pd.ExcelWriter(OUTPUT_XLSX, engine="openpyxl") as writer:
        for level_name in ("Governorate", "District", "Cadastre"):
            sheet = build_level_sheet(level_name)
            sheet.to_excel(writer, sheet_name=level_name, index=False)
            print(f"{level_name}: {len(sheet)} rows × {len(sheet.columns)} columns")

    print(f"Wrote {OUTPUT_XLSX}")


if __name__ == "__main__":
    main()
