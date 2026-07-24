#!/usr/bin/env python3
"""End-to-end vulnerability data pipeline."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parent
if str(PIPELINE_ROOT) not in sys.path:
    sys.path.insert(0, str(PIPELINE_ROOT))

from composite_scoring import run_composite_scoring
from config import LEVELS
from excel_to_csv import run_excel_to_csv
from geojson_join import run_geojson_join
from dis_to_gov_spatial import run_dis_to_gov_spatial
from indicator_weights_summary import run_indicator_weights_summary
from overall_geojson_join import run_overall_geojson_join
from overall_vulnerability import run_overall_vulnerability


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Automated pipeline: Excel (Master Sheet) -> RAW CSV -> "
            "composite scoring (T2-T4, T6-T8) -> overall vulnerability -> GeoJSON join "
            "-> overall vulnerability GeoJSON -> optional DIS-to-GOV spatial aggregate."
        )
    )
    parser.add_argument(
        "--stage",
        choices=("all", "excel", "composite", "overall", "join", "overall_join", "dis_to_gov", "weights_summary"),
        default="all",
        help="Pipeline stage to run (default: all).",
    )
    parser.add_argument(
        "--level",
        choices=(*LEVELS, "ALL"),
        default="ALL",
        help="Administrative level to process (default: ALL).",
    )
    return parser.parse_args()


def selected_levels(level_arg: str) -> tuple[str, ...]:
    if level_arg == "ALL":
        return LEVELS
    return (level_arg,)


def main() -> None:
    args = parse_args()
    levels = selected_levels(args.level)

    print(f"Automated_Pipeline root: {PIPELINE_ROOT}")
    print(f"Stage: {args.stage} | Levels: {', '.join(levels)}")

    if args.stage in ("all", "excel"):
        print("\n=== Stage 1: Excel -> RAW CSV (Master Sheet) ===")
        run_excel_to_csv(levels)

    if args.stage in ("all", "composite"):
        print("\n=== Stage 2: Composite scoring (T2-T4, T6-T8) ===")
        run_composite_scoring(levels)

    if args.stage in ("all", "overall"):
        print("\n=== Stage 3: Overall vulnerability index (T1-T8) ===")
        run_overall_vulnerability(levels)

    if args.stage in ("all", "join"):
        print("\n=== Stage 4: GeoJSON join (theme layers) ===")
        run_geojson_join(levels)

    if args.stage in ("all", "overall_join"):
        print("\n=== Stage 5: Overall vulnerability GeoJSON ===")
        run_overall_geojson_join(levels)

    if args.stage == "dis_to_gov":
        print("\n=== Optional: DIS -> GOV spatial aggregation ===")
        run_dis_to_gov_spatial()

    # After overall (and after dis_to_gov when that stage runs) so OVERALL sheet
    # includes direct + from_dis_spatial pillar weights when available.
    if args.stage in ("all", "overall", "dis_to_gov", "weights_summary"):
        print("\n=== Indicator weights summary (Excel) ===")
        run_indicator_weights_summary()

    print("\nPipeline complete.")


if __name__ == "__main__":
    main()
