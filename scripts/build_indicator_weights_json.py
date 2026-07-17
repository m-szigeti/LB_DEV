"""
Build data/indicator_weights.json from Indicator_Weights_Summary_tmp.xlsx
(falls back to Indicator_Weights_Summary.xlsx).

Sheet names map to map resolutions: DIS -> district, GOV -> governorate, CAD -> cadastre.
OVERALL sheet adds pillar weights for the Overall Vulnerability Index layer.
For GOV overall weights, prefer Source == from_dis_spatial (matches map GeoJSON).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
XLSX_TMP = ROOT / "scripts" / "Indicator_Weights_Summary_tmp.xlsx"
XLSX = ROOT / "scripts" / "Indicator_Weights_Summary.xlsx"
OUTPUT = ROOT / "data" / "indicator_weights.json"

SHEET_TO_RESOLUTION = {
    "DIS": "district",
    "GOV": "governorate",
    "CAD": "cadastre",
}

THEME_TO_LAYER = {
    "2": "svAdmin3Layer",
    "3": "svAdmin2Layer",
    "4": "svAdmin4Layer",
    "6": "svClimateLayer",
    "7": "svPoliticalLayer",
    "8": "svGenderLayer",
}

OVERALL_PILLAR_META = {
    1: {
        "label": "Displacement Pressure",
        "sourceLayerId": "svAdmin1Layer",
        "sourceField": "Displacement Ratio",
        "pillarField": "_pillar_T1",
    },
    2: {
        "label": "Tensions and Conflict Risk",
        "sourceLayerId": "svAdmin3Layer",
        "sourceField": "composite_score",
        "pillarField": "_pillar_T2",
    },
    3: {
        "label": "Socioeconomic Vulnerability",
        "sourceLayerId": "svAdmin2Layer",
        "sourceField": "composite_score",
        "pillarField": "_pillar_T3",
    },
    4: {
        "label": "Service & Infrastructure Vulnerability",
        "sourceLayerId": "svAdmin4Layer",
        "sourceField": "composite_score",
        "pillarField": "_pillar_T4",
    },
    5: {
        "label": "Demographic Tension / Stress",
        "sourceLayerId": "svAdmin5Layer",
        "sourceField": "Demographic Factor",
        "pillarField": "_pillar_T5",
    },
    6: {
        "label": "Climate and Environmental Risk",
        "sourceLayerId": "svClimateLayer",
        "sourceField": "composite_score",
        "pillarField": "_pillar_T6",
    },
    7: {
        "label": "Political Vulnerability",
        "sourceLayerId": "svPoliticalLayer",
        "sourceField": "composite_score",
        "pillarField": "_pillar_T7",
    },
    8: {
        "label": "Gender Based Vulnerabilities",
        "sourceLayerId": "svGenderLayer",
        "sourceField": "composite_score",
        "pillarField": "_pillar_T8",
    },
}

JOIN_KEYS = {
    "district": ["adm2_name", "ADM2_NAME", "ADM2_Name"],
    "governorate": ["adm1_name", "ADM1_NAME", "ADM1_Name"],
    "cadastre": ["adm3_pcode", "ACS_CODE", "acs_code", "ADM3_NAME", "adm3_name"],
}

INVERTED_INDICATORS = frozenset({
    "Nighttime light radiance",
    "Nightlight Intensity",
})

THEME_NUM_RE = re.compile(r"^T(\d+)\b", re.IGNORECASE)


def resolve_workbook() -> Path:
    if XLSX_TMP.exists():
        return XLSX_TMP
    if XLSX.exists():
        return XLSX
    raise FileNotFoundError(f"Missing weights workbook: tried {XLSX_TMP} and {XLSX}")


def parse_theme_number(indicator: str) -> int | None:
    match = THEME_NUM_RE.match(str(indicator).strip())
    if not match:
        return None
    return int(match.group(1))


def build_theme_block(df: pd.DataFrame) -> dict:
    res_block: dict = {}
    for theme_key, layer_id in THEME_TO_LAYER.items():
        theme_num = int(theme_key)
        theme_rows = df[df["Theme"] == theme_num]
        if theme_rows.empty:
            continue
        scored = theme_rows[theme_rows["Composite_Scored"].astype(str).str.strip().str.lower() == "yes"]
        if scored.empty:
            continue

        theme_name = str(scored.iloc[0]["Theme_Name"]).strip()
        indicators = []
        for _, row in scored.iterrows():
            if pd.isna(row["Subindicator"]):
                continue
            field = str(row["Subindicator"])
            if not field.strip():
                continue
            weight = row["Final_Weight"]
            default_weight = float(weight) if pd.notna(weight) else 0.0
            indicators.append({
                "field": field,
                "label": field.strip(),
                "defaultWeight": round(default_weight, 6),
                "inverted": field in INVERTED_INDICATORS,
            })

        if not indicators:
            continue

        res_block[theme_key] = {
            "layerId": layer_id,
            "themeName": theme_name,
            "compositeField": "composite_score",
            "mode": "theme-subindicators",
            "indicators": indicators,
        }
    return res_block


def preferred_overall_rows(df: pd.DataFrame, level: str) -> pd.DataFrame:
    level_rows = df[df["Level"].astype(str).str.strip().str.upper() == level]
    if level_rows.empty:
        return level_rows
    if level == "GOV":
        spatial = level_rows[
            level_rows["Source"].astype(str).str.strip().str.lower() == "from_dis_spatial"
        ]
        if not spatial.empty:
            return spatial
    direct = level_rows[level_rows["Source"].astype(str).str.strip().str.lower() == "direct"]
    return direct if not direct.empty else level_rows


def build_overall_block(overall_df: pd.DataFrame, level: str, resolution: str) -> dict | None:
    rows = preferred_overall_rows(overall_df, level)
    if rows.empty:
        return None

    indicators = []
    for _, row in rows.iterrows():
        theme_num = parse_theme_number(row["Indicator"])
        if theme_num is None or theme_num not in OVERALL_PILLAR_META:
            continue
        meta = OVERALL_PILLAR_META[theme_num]
        weight = row["Final_Weight"]
        default_weight = float(weight) if pd.notna(weight) else 0.0
        indicators.append({
            "field": meta["pillarField"],
            "label": meta["label"],
            "defaultWeight": round(default_weight, 6),
            "inverted": False,
            "sourceLayerId": meta["sourceLayerId"],
            "sourceField": meta["sourceField"],
            "themeNumber": theme_num,
        })

    if not indicators:
        return None

    return {
        "layerId": "svOverallTensionLayer",
        "themeName": "Overall Vulnerability Index",
        "compositeField": "overall_vulnerability_score",
        "mode": "overall-pillars",
        "joinKeys": JOIN_KEYS[resolution],
        "indicators": indicators,
    }


def build() -> dict:
    workbook = resolve_workbook()
    print(f"Using workbook: {workbook.name}")
    out: dict = {}
    xl = pd.ExcelFile(workbook)

    for sheet, resolution in SHEET_TO_RESOLUTION.items():
        if sheet not in xl.sheet_names:
            continue
        df = pd.read_excel(workbook, sheet_name=sheet)
        res_block = build_theme_block(df)
        if res_block:
            out[resolution] = res_block

    if "OVERALL" in xl.sheet_names:
        overall_df = pd.read_excel(workbook, sheet_name="OVERALL")
        for level, resolution in SHEET_TO_RESOLUTION.items():
            overall_block = build_overall_block(overall_df, level, resolution)
            if not overall_block:
                continue
            out.setdefault(resolution, {})
            out[resolution]["overall"] = overall_block

    return out


def main() -> None:
    payload = build()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT}")
    for resolution, themes in payload.items():
        keys = ", ".join(sorted(themes.keys(), key=lambda k: (k != "overall", k)))
        print(f"  {resolution}: {keys}")


if __name__ == "__main__":
    main()
