"""
Build data/indicator_weights.json from Indicator_Weights_Summary.xlsx.

Sheet names map to map resolutions: DIS -> district, GOV -> governorate, CAD -> cadastre.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
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

INVERTED_INDICATORS = frozenset({
    "Nighttime light radiance",
    "Nightlight Intensity",
})


def build() -> dict:
    if not XLSX.exists():
        raise FileNotFoundError(f"Missing weights workbook: {XLSX}")

    out: dict = {}
    xl = pd.ExcelFile(XLSX)

    for sheet, resolution in SHEET_TO_RESOLUTION.items():
        if sheet not in xl.sheet_names:
            continue
        df = pd.read_excel(XLSX, sheet_name=sheet)
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
                    "label": field,
                    "defaultWeight": round(default_weight, 6),
                    "inverted": field in INVERTED_INDICATORS,
                })

            if not indicators:
                continue

            res_block[theme_key] = {
                "layerId": layer_id,
                "themeName": theme_name,
                "compositeField": "composite_score",
                "indicators": indicators,
            }

        if res_block:
            out[resolution] = res_block

    return out


def main() -> None:
    payload = build()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT}")
    for resolution, themes in payload.items():
        print(f"  {resolution}: {len(themes)} themes")


if __name__ == "__main__":
    main()
