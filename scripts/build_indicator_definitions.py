"""Build js/indicator_definitions.js from scripts/Indicators_Inside_Tool.xlsx."""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "scripts" / "Indicators_Inside_Tool.xlsx"
OUT = ROOT / "js" / "indicator_definitions.js"

THEME_TO_LAYER = {
    "Displacement Pressure": "svAdmin1Layer",
    "Tensions and Conflict Risk": "svAdmin3Layer",
    "Socioeconomic Vulnerability": "svAdmin2Layer",
    "Service & Infrastructure Vulnerability": "svAdmin4Layer",
    "Demographic Tension / Stress": "svAdmin5Layer",
    "Climate and Environmental Risk": "svClimateLayer",
    "Political Vulnerability": "svPoliticalLayer",
    "Gender Based Vulnerabilities": "svGenderLayer",
}


def main() -> None:
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    headers = [str(h).strip() if h else "" for h in rows[0]]
    idx = {h: i for i, h in enumerate(headers)}

    by_layer: dict[str, list] = defaultdict(list)
    for row in rows[1:]:
        if not row or row[idx["Theme Name"]] is None:
            continue
        theme = str(row[idx["Theme Name"]]).strip()
        indicator = str(row[idx["Indicator"]]).strip() if row[idx["Indicator"]] else ""
        definition_raw = row[idx["Definition"]]
        definition = (
            str(definition_raw).strip() if definition_raw not in (None, "") else ""
        )
        code = str(row[idx["Code"]]).strip() if row[idx["Code"]] else ""
        type_q_raw = row[idx["Type question"]]
        type_question = str(type_q_raw).strip() if type_q_raw not in (None, "") else ""
        layer_id = THEME_TO_LAYER.get(theme)
        if not layer_id or not indicator:
            continue
        theme_number = row[idx["Theme #"]]
        by_layer[layer_id].append(
            {
                "code": code,
                "indicator": indicator,
                "definition": definition,
                "typeQuestion": type_question,
                "themeName": theme,
                "themeNumber": int(theme_number) if theme_number is not None else None,
            }
        )

    layer_theme_names = {layer: theme for theme, layer in THEME_TO_LAYER.items()}
    payload = dict(by_layer)

    js = f"""/**
 * Indicator definitions for Active Layers (from scripts/Indicators_Inside_Tool.xlsx).
 * Keys are SV layer ids; each entry lists Indicator + Definition for that theme.
 * Regenerate: python scripts/build_indicator_definitions.py
 */

/** @typedef {{
 *   code: string,
 *   indicator: string,
 *   definition: string,
 *   typeQuestion: string,
 *   themeName: string,
 *   themeNumber: number|null
 * }} IndicatorDefinition */

/** @type {{Record<string, IndicatorDefinition[]>}} */
export const INDICATOR_DEFINITIONS_BY_LAYER = {json.dumps(payload, ensure_ascii=False, indent=2)};

export const LAYER_THEME_NAMES = {json.dumps(layer_theme_names, ensure_ascii=False, indent=2)};

export function getIndicatorDefinitionsForLayer(layerId) {{
    return INDICATOR_DEFINITIONS_BY_LAYER[layerId] || [];
}}
"""
    OUT.write_text(js, encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({sum(len(v) for v in by_layer.values())} indicators)")


if __name__ == "__main__":
    main()
