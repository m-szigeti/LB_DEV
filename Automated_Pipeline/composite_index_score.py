"""
Compute composite index scores for vulnerability indicator tables.

Expected columns:
  - One admin id column (ADM1/2/3_Name, ACS_CODE, etc.) for labelling output
  - Optional additional metadata columns (kept in output, excluded from scoring)
  - All remaining columns treated as vulnerability indicators
"""

from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import pandas as pd
from io_utils import read_csv_flexible, write_csv_unicode

OUTPUT_MARKERS = ("_Scored.csv", "_Weights.csv", "_Kendall_Matrix.csv")

DIST_COL_PRIORITY = (
    ("ADM3_Name", "ADM3_NAME", "adm3_name", "adm3_name1"),
    ("ADM2_Name", "ADM2_NAME", "adm2_name", "adm2_name2"),
    ("ADM1_Name", "ADM1_NAME", "adm1_name", "adm1_name1"),
    ("ACS_Code", "ACS Code", "acs_code"),
)

EXCLUDED_INDEX_COLUMN_NAMES = frozenset(
    name.casefold()
    for name in (
        "ADM1_Name",
        "ADM2_Name",
        "ADM3_Name",
        "ADM1_NAME",
        "ADM2_NAME",
        "ADM3_NAME",
        "DISTRICT",
        "district",
        "adm1_pcode",
        "adm2_pcode",
        "adm3_pcode",
        "adm1_name",
        "adm2_name",
        "adm3_name",
    )
)

METADATA_COLUMNS = frozenset({
    "acs_code", "acs code", "acs_name",
    "cad_code", "cad_name",
    "code", "code_new", "code_min", "code_max",
    "adm0_name", "adm0_pcode",
    "adm1_name1", "adm1_name2", "adm1_name3",
    "adm1_name_max", "adm2_name_max", "adm3_name_max",
    "adm2_name1", "adm2_name2", "adm2_name3",
    "adm3_name1", "adm3_name2", "adm3_name3",
    "adm3_int",
    "governorate_ai", "district_ai",
    "m_ref_name_n", "k_ref_name", "c_ref_name", "c_ref_ar",
    "mohafaza_1_max",
    "longitude", "latitude",
    "rank", "composite_score", "composite_score_mean",
    "eviction date",
}) | EXCLUDED_INDEX_COLUMN_NAMES

METADATA_PATTERNS = tuple(
    re.compile(p, re.IGNORECASE)
    for p in (
        r"^adm[123]_(name|pcode)(\d|_max)?$",
        r"^adm\d+_",
        r"^acs_",
        r"^cad_",
        r"^district$",
        r"_pcode$",
        r"_join_key$",
        r"_ref_",
        r"^governorate",
        r"^district_ai$",
        r"^norm_",
        r"^weight_",
        r"^weighted_",
    )
)

INVERTED_INDICATORS = frozenset({
    # Existing
    "Nighttime light radiance",
    "Nightlight Intensity",
    "Consecutive Wet Days",
    "Days withh at least 10 mm rainfall",
    "Days withh at least 20 mm rainfall"
})


def indicator_is_inverted(col: str) -> bool:
    return col in INVERTED_INDICATORS


def to_numeric_binary_aware(series: pd.Series) -> pd.Series:
    s_str = series.astype("string").str.strip().str.lower()
    binary_map = {
        "true": 1, "false": 0, "yes": 1, "no": 0, "y": 1, "n": 0, "1": 1, "0": 0,
    }
    mapped = s_str.map(binary_map)
    numeric = pd.to_numeric(series, errors="coerce")
    return mapped.where(mapped.notna(), numeric).astype(float)


def minmax01(series: pd.Series) -> pd.Series:
    s = to_numeric_binary_aware(series)
    smin, smax = np.nanmin(s.values), np.nanmax(s.values)
    if not np.isfinite(smin) or not np.isfinite(smax) or smax == smin:
        return pd.Series(np.zeros(len(s)), index=series.index)
    return (s - smin) / (smax - smin)


def normalize_indicator(series: pd.Series, invert: bool = False) -> pd.Series:
    norm = minmax01(series)
    return 1.0 - norm if invert else norm


def safe_kendall(x: pd.Series, y: pd.Series) -> float:
    x_ = to_numeric_binary_aware(x)
    y_ = to_numeric_binary_aware(y)
    mask = x_.notna() & y_.notna()
    if mask.sum() < 2:
        return 0.0
    if x_[mask].nunique() < 2 or y_[mask].nunique() < 2:
        return 0.0
    return float(pd.Series(x_[mask]).corr(pd.Series(y_[mask]), method="kendall"))


def is_metadata_column(col: str) -> bool:
    name = col.strip()
    if not name:
        return True
    folded = name.casefold()
    if folded in EXCLUDED_INDEX_COLUMN_NAMES:
        return True
    if folded in METADATA_COLUMNS:
        return True
    return any(pattern.search(name) for pattern in METADATA_PATTERNS)


def pick_dist_column(columns: list[str]) -> str:
    column_set = set(columns)
    for variants in DIST_COL_PRIORITY:
        for variant in variants:
            if variant in column_set:
                return variant
    raise ValueError(
        "No supported unit id column found. Expected one of: "
        + ", ".join(v for group in DIST_COL_PRIORITY for v in group)
    )


def detect_columns(df: pd.DataFrame) -> tuple[str, list[str], list[str]]:
    col_dist = pick_dist_column(list(df.columns))
    id_cols = [c for c in df.columns if is_metadata_column(c)]
    if col_dist not in id_cols:
        id_cols.insert(0, col_dist)
    keep_id_cols = [col_dist] + [c for c in id_cols if c != col_dist]
    indicator_cols = [c for c in df.columns if c not in id_cols]
    if not indicator_cols:
        raise ValueError("No indicator columns found after excluding metadata/id columns")
    return col_dist, keep_id_cols, indicator_cols


def score_dataframe(
    df: pd.DataFrame,
    custom_weights: dict[str, float] | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, list[str]]:
    """
    Return scored dataframe, weights table, kendall matrix, and indicator column names.

    If custom_weights is provided and matches indicator columns, those weights are
    used for the composite (after renormalisation). Kendall statistics are still
    computed for reporting.
    """
    work = df.copy()
    col_dist, keep_id_cols, indicator_cols = detect_columns(work)

    for col in indicator_cols:
        work[col] = to_numeric_binary_aware(work[col])
    work[indicator_cols] = work[indicator_cols].apply(lambda s: s.fillna(s.median()))

    for col in indicator_cols:
        work[f"norm_{col}"] = normalize_indicator(work[col], invert=indicator_is_inverted(col))

    kendall_matrix = pd.DataFrame(index=indicator_cols, columns=indicator_cols, dtype=float)
    for c1 in indicator_cols:
        for c2 in indicator_cols:
            kendall_matrix.loc[c1, c2] = (
                1.0 if c1 == c2 else safe_kendall(work[f"norm_{c1}"], work[f"norm_{c2}"])
            )

    mean_abs_corr = {}
    for col in indicator_cols:
        others = [abs(kendall_matrix.loc[col, other]) for other in indicator_cols if other != col]
        mean_abs_corr[col] = float(np.mean(others)) if others else 0.0

    total_strength = sum(mean_abs_corr.values())
    if total_strength == 0:
        kendall_weights = {col: 1.0 / len(indicator_cols) for col in indicator_cols}
    else:
        kendall_weights = {col: mean_abs_corr[col] / total_strength for col in indicator_cols}

    weights = kendall_weights
    weight_sources = {col: "kendall" for col in indicator_cols}
    if custom_weights:
        # Local import keeps composite_index_score usable as a standalone script.
        from custom_weights import resolve_weights_for_indicators

        resolved, source = resolve_weights_for_indicators(indicator_cols, custom_weights)
        if resolved:
            weights = resolved
            weight_sources = {col: source for col in indicator_cols}

    for col in indicator_cols:
        work[f"weight_{col}"] = weights[col]
        work[f"weighted_{col}"] = work[f"norm_{col}"] * weights[col]

    work["composite_score"] = work[[f"weighted_{col}" for col in indicator_cols]].sum(axis=1)
    work = work.sort_values("composite_score", ascending=False).reset_index(drop=True)
    work["rank"] = np.arange(1, len(work) + 1)

    weights_table = pd.DataFrame({
        "Indicator": indicator_cols,
        "Mean_Abs_Kendall_tau": [mean_abs_corr[col] for col in indicator_cols],
        "Final_Weight": [weights[col] for col in indicator_cols],
        "Weight_Source": [weight_sources[col] for col in indicator_cols],
    })

    return work, weights_table, kendall_matrix, indicator_cols


def build_pipeline_export(
    scored_df: pd.DataFrame,
    col_dist: str,
    keep_id_cols: list[str],
    indicator_cols: list[str],
    level: str,
) -> pd.DataFrame:
    """Extract join keys, raw indicators, and composite_score for pipeline CSV output."""
    export_cols: list[str] = []
    for col in keep_id_cols:
        if col in scored_df.columns and col not in export_cols:
            export_cols.append(col)

    if level == "CAD" and not any(c.casefold() == "acs_code" for c in export_cols):
        for candidate in ("ACS_Code", "ACS Code", "acs_code"):
            if candidate in scored_df.columns:
                export_cols.insert(1 if col_dist in export_cols else 0, candidate)
                break

    export_cols.extend(col for col in indicator_cols if col in scored_df.columns)
    if "composite_score" in scored_df.columns:
        export_cols.append("composite_score")
    return scored_df[export_cols].copy()


def is_source_csv(path: Path) -> bool:
    if path.suffix.lower() != ".csv":
        return False
    return not any(path.name.endswith(marker) for marker in OUTPUT_MARKERS)


def process_file(input_path: Path) -> None:
    output_prefix = input_path.stem
    output_dir = input_path.parent

    df = read_csv_flexible(input_path)
    scored_df, weights_table, kendall_matrix, indicator_cols = score_dataframe(df)
    col_dist, keep_id_cols, _ = detect_columns(df)

    export_cols = [
        "rank",
        col_dist,
        *([c for c in keep_id_cols if c != col_dist]),
        *indicator_cols,
        *[f"norm_{col}" for col in indicator_cols],
        *[f"weight_{col}" for col in indicator_cols],
        *[f"weighted_{col}" for col in indicator_cols],
        "composite_score",
    ]

    scored_csv = output_dir / f"{output_prefix}_Scored.csv"
    weights_csv = output_dir / f"{output_prefix}_Weights.csv"
    kendall_csv = output_dir / f"{output_prefix}_Kendall_Matrix.csv"

    write_csv_unicode(scored_df[export_cols], scored_csv, index=False)
    write_csv_unicode(weights_table, weights_csv, index=False)
    write_csv_unicode(kendall_matrix, kendall_csv, index=True)

    top = scored_df.iloc[0]
    print(f"\n=== {input_path.name} ===")
    print(f"Top unit: {top[col_dist]} (rank {int(top['rank'])}, score {top['composite_score']:.4f})")
    print(f"Saved: {scored_csv.name}, {weights_csv.name}, {kendall_csv.name}")


def main() -> None:
    work_dir = Path.cwd()
    input_files = sorted(p for p in work_dir.glob("*.csv") if is_source_csv(p))
    if not input_files:
        print(f"No source CSV files found in {work_dir}")
        return

    for input_path in input_files:
        try:
            process_file(input_path)
        except ValueError as exc:
            print(f"Skipped {input_path.name}: {exc}")


if __name__ == "__main__":
    main()
