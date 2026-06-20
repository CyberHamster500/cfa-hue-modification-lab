from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app.core.camera_metadata import extract_exif_camera, lookup_camera_cfa
from app.core.hue import AnalysisOptions, analyze_image, load_rgb_image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze one image for CFA-based hue modification traces.")
    parser.add_argument("image", type=Path, help="PNG or JPEG image path.")
    parser.add_argument("--ds", type=int, default=10, help="Hue search step in degrees. Default: 10.")
    parser.add_argument("--block-size", type=int, default=128, help="Heatmap block size in pixels. Default: 128.")
    parser.add_argument("--max-side", type=int, default=768, help="Resize longest side before analysis. Default: 768.")
    parser.add_argument("--mode", choices=["AUTO", "GXXG", "XGGX"], default="AUTO", help="CFA green mode. Default: AUTO.")
    parser.add_argument("--json", action="store_true", help="Print the full analysis JSON, including curves and heatmap.")
    return parser.parse_args()


def _summary(result: dict, image_path: Path) -> str:
    camera = result["camera"]
    options = result["options"]
    prediction = result["cfa_prediction"]
    estimate = result["estimate"]
    camera_name = " ".join(part for part in [camera.get("make"), camera.get("model")] if part) or "unknown"
    rows = [
        ("file", str(image_path)),
        ("camera", camera_name),
        ("cfa_lookup_status", camera["lookup_status"]),
        ("bayer_pattern", camera["bayer_pattern"] or "unknown"),
        ("resolved_green_mode", options["resolved_cfa_green_mode"]),
        ("mode_source", options["cfa_resolution_source"]),
        ("image_estimate_mode", prediction["mode"]),
        ("image_estimate_confidence", f"{float(prediction['confidence']) * 100:.2f}%"),
        ("image_estimate_reliability", prediction["reliability"]),
        ("estimated_hue_shift", f"{float(estimate['estimated_hue']):.1f} deg"),
        ("criterion", estimate["criterion"]),
        ("image_size", f"{result['width']} x {result['height']}"),
    ]
    width = max(len(key) for key, _ in rows)
    return "\n".join(f"{key:<{width}} : {value}" for key, value in rows)


def main() -> int:
    args = parse_args()
    if not args.image.exists():
        print(f"image not found: {args.image}", file=sys.stderr)
        return 2

    data = args.image.read_bytes()
    camera = lookup_camera_cfa(extract_exif_camera(data))
    preferred_mode = camera["green_mode"] if args.mode == "AUTO" else None
    rgb = load_rgb_image(data, max_side=args.max_side)
    result = analyze_image(
        rgb,
        AnalysisOptions(
            ds=args.ds,
            block_size=args.block_size,
            cfa_green_mode=args.mode,
            preferred_cfa_green_mode=preferred_mode,  # type: ignore[arg-type]
        ),
    )
    result["camera"] = camera

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(_summary(result, args.image))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
