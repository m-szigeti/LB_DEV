"""
Compute composite index scores for every source CSV in the working directory.

Expected columns:
  - ADM2_Name or ADM3_Name (district / cadastre id)
  - ACS_CODE (optional, kept in output)
  - all other columns treated as indicators

Writes per input file <name>_Scored.csv, <name>_Weights.csv, <name>_Kendall_Matrix.csv
"""

from pathlib import Path

import numpy as np
import pandas as pd

DIST_COLS = ("ADM2_Name", "ADM3_Name")
OUTPUT_MARKERS = ("_Scored.csv", "_Weights.csv", "_Kendall_Matrix.csv")


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


def safe_kendall(x: pd.Series, y: pd.Series) -> float:
    x_ = to_numeric_binary_aware(x)
    y_ = to_numeric_binary_aware(y)
    mask = x_.notna() & y_.notna()
    if mask.sum() < 2:
        return 0.0
    if x_[mask].nunique() < 2 or y_[mask].nunique() < 2:
        return 0.0
    return float(pd.Series(x_[mask]).corr(pd.Series(y_[mask]), method="kendall"))


def detect_columns(df: pd.DataFrame) -> tuple[str, list[str], list[str]]:
    dist_cols = [c for c in DIST_COLS if c in df.columns]
    if len(dist_cols) != 1:
        raise ValueError(f"Expected exactly one of {DIST_COLS}, found: {dist_cols or 'none'}")
    col_dist = dist_cols[0]
    keep_id_cols = [col_dist]
    if "ACS_CODE" in df.columns:
        keep_id_cols.append("ACS_CODE")
    indicator_cols = [c for c in df.columns if c not in keep_id_cols]
    if not indicator_cols:
        raise ValueError("No indicator columns found after excluding id columns")
    return col_dist, keep_id_cols, indicator_cols


def is_source_csv(path: Path) -> bool:
    if path.suffix.lower() != ".csv":
        return False
    return not any(path.name.endswith(marker) for marker in OUTPUT_MARKERS)


def process_file(input_path: Path) -> None:
    output_prefix = input_path.stem
    output_dir = input_path.parent

    df = pd.read_csv(input_path)
    col_dist, keep_id_cols, indicator_cols = detect_columns(df)

    for col in indicator_cols:
        df[col] = to_numeric_binary_aware(df[col])
    df[indicator_cols] = df[indicator_cols].apply(lambda s: s.fillna(s.median()))

    for col in indicator_cols:
        df[f"norm_{col}"] = minmax01(df[col])

    kendall_matrix = pd.DataFrame(index=indicator_cols, columns=indicator_cols, dtype=float)
    for c1 in indicator_cols:
        for c2 in indicator_cols:
            kendall_matrix.loc[c1, c2] = (
                1.0 if c1 == c2 else safe_kendall(df[f"norm_{c1}"], df[f"norm_{c2}"])
            )

    mean_abs_corr = {}
    for col in indicator_cols:
        others = [abs(kendall_matrix.loc[col, other]) for other in indicator_cols if other != col]
        mean_abs_corr[col] = float(np.mean(others)) if others else 0.0

    total_strength = sum(mean_abs_corr.values())
    if total_strength == 0:
        weights = {col: 1.0 / len(indicator_cols) for col in indicator_cols}
    else:
        weights = {col: mean_abs_corr[col] / total_strength for col in indicator_cols}

    for col in indicator_cols:
        df[f"weight_{col}"] = weights[col]
        df[f"weighted_{col}"] = df[f"norm_{col}"] * weights[col]

    df["composite_score"] = df[[f"weighted_{col}" for col in indicator_cols]].sum(axis=1)
    df = df.sort_values("composite_score", ascending=False).reset_index(drop=True)
    df["rank"] = np.arange(1, len(df) + 1)

    weights_table = pd.DataFrame({
        "Indicator": indicator_cols,
        "Mean_Abs_Kendall_tau": [mean_abs_corr[col] for col in indicator_cols],
        "Final_Weight": [weights[col] for col in indicator_cols],
    })

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

    df[export_cols].to_csv(scored_csv, index=False)
    weights_table.to_csv(weights_csv, index=False)
    kendall_matrix.to_csv(kendall_csv, index=True)

    top = df.iloc[0]
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
