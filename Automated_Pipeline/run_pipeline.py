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
from config import (
    LEVELS,
    PIPELINE_VARIANTS,
    VARIANT_BOTH,
    VARIANT_CUSTOM,
    VARIANT_STANDARD,
    custom_output_root,
    custom_weights_dir,
    default_output_root,
    get_output_root,
    using_output_root,
)
from custom_weights import WEIGHT_MODE_CUSTOM, WEIGHT_MODE_KENDALL
from excel_to_csv import run_excel_to_csv
from geojson_join import run_geojson_join
from dis_to_gov_spatial import run_dis_to_gov_spatial
from indicator_weights_summary import run_indicator_weights_summary
from overall_geojson_join import run_overall_geojson_join
from overall_vulnerability import run_overall_vulnerability


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Automated pipeline: Excel -> RAW CSV -> composite scoring -> overall -> "
            "joined GeoJSON -> overall GeoJSON -> DIS-to-GOV spatial (always in full runs). "
            "GEOJSON/ is source polygons only. Default Kendall outputs go to DEFAULT/; "
            "sandbox-weight outputs go to CUSTOM/."
        )
    )
    parser.add_argument(
        "--stage",
        choices=(
            "all",
            "excel",
            "composite",
            "overall",
            "join",
            "overall_join",
            "dis_to_gov",
            "weights_summary",
        ),
        default="all",
        help="Pipeline stage to run (default: all).",
    )
    parser.add_argument(
        "--level",
        choices=(*LEVELS, "ALL"),
        default="ALL",
        help="Administrative level to process (default: ALL).",
    )
    parser.add_argument(
        "--variant",
        choices=PIPELINE_VARIANTS,
        default=VARIANT_BOTH,
        help=(
            "Which output tree(s) to build: 'standard' (DEFAULT/, Kendall), "
            "'custom' (CUSTOM/, sandbox weights), or 'both' (default)."
        ),
    )
    parser.add_argument(
        "--custom-weights-dir",
        default=None,
        help=(
            "Folder containing sandbox *_weights_before_after.csv inputs "
            f"(default: {custom_weights_dir()})."
        ),
    )
    return parser.parse_args()


def selected_levels(level_arg: str) -> tuple[str, ...]:
    if level_arg == "ALL":
        return LEVELS
    return (level_arg,)


def selected_variants(variant_arg: str) -> list[str]:
    if variant_arg == VARIANT_BOTH:
        return [VARIANT_STANDARD, VARIANT_CUSTOM]
    return [variant_arg]


def run_scoring_through_spatial(
    levels: tuple[str, ...],
    *,
    weight_mode: str,
    custom_weights_path: str | Path | None,
    include_dis_to_gov: bool,
    include_weights_summary: bool,
) -> None:
    """Composite → overall → join → overall_join → optional dis_to_gov + weights summary."""
    label = "CUSTOM" if get_output_root().resolve() == custom_output_root().resolve() else "DEFAULT"
    print(f"\n--- {label} outputs → {get_output_root()} ---")
    print(f"Weight mode: {weight_mode}")

    print("\n=== Composite scoring (T2-T4, T6-T8) ===")
    run_composite_scoring(
        levels,
        weight_mode=weight_mode,
        custom_weights_dir=custom_weights_path,
    )

    print("\n=== Overall vulnerability index (T1-T8) ===")
    if weight_mode == WEIGHT_MODE_CUSTOM:
        print(
            "Overall pillars use theme composite_score values from this variant "
            "(custom-weighted themes included). Pillar combination still uses Kendall."
        )
    run_overall_vulnerability(levels)

    print("\n=== Join theme attributes onto source GeoJSON (exports under output tree) ===")
    run_geojson_join(levels)

    print("\n=== Overall vulnerability GeoJSON ===")
    run_overall_geojson_join(levels)

    if include_dis_to_gov:
        print("\n=== DIS -> GOV spatial aggregation ===")
        run_dis_to_gov_spatial(
            weight_mode=weight_mode,
            custom_weights_dir=custom_weights_path,
        )

    if include_weights_summary:
        print("\n=== Indicator weights summary (Excel) ===")
        run_indicator_weights_summary()


def run_stage_for_variant(
    stage: str,
    levels: tuple[str, ...],
    *,
    weight_mode: str,
    custom_weights_path: str | Path | None,
) -> None:
    if stage == "composite":
        run_composite_scoring(
            levels,
            weight_mode=weight_mode,
            custom_weights_dir=custom_weights_path,
        )
    elif stage == "overall":
        run_overall_vulnerability(levels)
    elif stage == "join":
        run_geojson_join(levels)
    elif stage == "overall_join":
        run_overall_geojson_join(levels)
    elif stage == "dis_to_gov":
        run_dis_to_gov_spatial(
            weight_mode=weight_mode,
            custom_weights_dir=custom_weights_path,
        )
    elif stage == "weights_summary":
        run_indicator_weights_summary()


def main() -> None:
    args = parse_args()
    levels = selected_levels(args.level)
    variants = selected_variants(args.variant)
    weights_dir = args.custom_weights_dir

    print(f"Automated_Pipeline root: {PIPELINE_ROOT}")
    print(f"Stage: {args.stage} | Levels: {', '.join(levels)} | Variant(s): {', '.join(variants)}")
    print(f"Source GeoJSON (read-only): {PIPELINE_ROOT / 'GEOJSON'}")
    print(f"DEFAULT outputs: {default_output_root()}")
    if VARIANT_CUSTOM in variants:
        print(f"Custom weights inputs: {custom_weights_dir(weights_dir)}")
        print(f"CUSTOM outputs: {custom_output_root()}")

    if args.stage in ("all", "excel"):
        print("\n=== Stage 1: Excel -> RAW CSV (Master Sheet, shared) ===")
        run_excel_to_csv(levels)
        if args.stage == "excel":
            print("\nPipeline complete.")
            return

    for variant in variants:
        weight_mode = (
            WEIGHT_MODE_CUSTOM if variant == VARIANT_CUSTOM else WEIGHT_MODE_KENDALL
        )
        output_root = (
            custom_output_root() if variant == VARIANT_CUSTOM else default_output_root()
        )
        output_root.mkdir(parents=True, exist_ok=True)

        with using_output_root(output_root):
            if args.stage == "all":
                run_scoring_through_spatial(
                    levels,
                    weight_mode=weight_mode,
                    custom_weights_path=weights_dir if variant == VARIANT_CUSTOM else None,
                    include_dis_to_gov=True,
                    include_weights_summary=True,
                )
            else:
                print(
                    f"\n--- {variant.upper()} → {get_output_root()} "
                    f"(weight_mode={weight_mode}) ---"
                )
                run_stage_for_variant(
                    args.stage,
                    levels,
                    weight_mode=weight_mode,
                    custom_weights_path=weights_dir if variant == VARIANT_CUSTOM else None,
                )

    print("\nPipeline complete.")


if __name__ == "__main__":
    main()
