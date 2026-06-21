from __future__ import annotations

import argparse
import json
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image

from app.core.camera_metadata import extract_exif_camera, lookup_camera_cfa
from app.core.hue import AnalysisOptions, analyze_image, angular_error, load_rgb_image, shift_hue_hsi
from app.core.raw_develop import develop_raw_with_rawpy


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run RAW development ablation for CFA hue modification analysis.")
    parser.add_argument("raw_image", type=Path, help="RAW image path, for example NEF, CR2, ARW, DNG, or ORF.")
    parser.add_argument("--backend", choices=["rawpy"], default="rawpy", help="RAW developer backend. Default: rawpy.")
    parser.add_argument("--ds", type=int, default=10, help="Hue search step in degrees. Default: 10.")
    parser.add_argument("--block-size", type=int, default=128, help="Heatmap block size in pixels. Default: 128.")
    parser.add_argument("--max-side", type=int, default=768, help="Resize longest side before analysis. Default: 768.")
    parser.add_argument("--mode", choices=["AUTO", "GXXG", "XGGX"], default="AUTO", help="CFA green mode. Default: AUTO.")
    parser.add_argument("--known-shift", type=float, default=120.0, help="Synthetic hue shift for validation.")
    parser.add_argument(
        "--jpeg-quality",
        type=int,
        nargs="*",
        default=[95, 85, 70, 50],
        help="JPEG quality levels for compression ablation. Use no values to skip.",
    )
    parser.add_argument("--json", action="store_true", help="Print full JSON instead of compact summary.")
    return parser.parse_args()


def _jpeg_roundtrip(rgb, quality: int):
    image = Image.fromarray(rgb, "RGB")
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=quality)
    return load_rgb_image(buffer.getvalue(), max_side=max(rgb.shape[:2]))


def _analyze(rgb, args: argparse.Namespace, preferred_mode: str | None) -> dict:
    result = analyze_image(
        rgb,
        AnalysisOptions(
            ds=args.ds,
            block_size=args.block_size,
            cfa_green_mode=args.mode,
            preferred_cfa_green_mode=preferred_mode,  # type: ignore[arg-type]
        ),
    )
    if args.mode == "AUTO" and preferred_mode:
        result["options"]["cfa_resolution_source"] = "raw_pattern"
    return result


def _camera_from_raw(path: Path) -> dict[str, object]:
    try:
        return lookup_camera_cfa(extract_exif_camera(path.read_bytes()))
    except Exception:
        return {
            "make": "",
            "model": "",
            "software": "",
            "normalized_key": "",
            "bayer_pattern": None,
            "green_mode": None,
            "source": "RAW EXIF could not be read by Pillow; using rawpy metadata and image-based auto estimate",
            "source_url": None,
            "lookup_status": "unknown",
        }


def _compact(result: dict) -> dict[str, object]:
    return {
        "estimated_hue": result["estimate"]["estimated_hue"],
        "hm": result["estimate"]["hm"],
        "criterion": result["estimate"]["criterion"],
        "resolved_cfa_green_mode": result["options"]["resolved_cfa_green_mode"],
        "cfa_resolution_source": result["options"]["cfa_resolution_source"],
        "image_estimate_mode": result["cfa_prediction"]["mode"],
        "image_estimate_confidence": result["cfa_prediction"]["confidence"],
        "image_estimate_reliability": result["cfa_prediction"]["reliability"],
        "size": [result["width"], result["height"]],
    }


def main() -> int:
    args = parse_args()
    if not args.raw_image.exists():
        print(f"RAW image not found: {args.raw_image}", file=sys.stderr)
        return 2

    if args.backend != "rawpy":
        print("Only rawpy is currently supported.", file=sys.stderr)
        return 2

    rgb, raw_metadata = develop_raw_with_rawpy(args.raw_image, max_side=args.max_side)
    camera = _camera_from_raw(args.raw_image)
    preferred_mode = None
    if args.mode == "AUTO":
        # For RAW ablation, the pattern read from the RAW container is the
        # direct evidence for this file. The curated camera table is a fallback.
        preferred_mode = str(raw_metadata.get("green_mode") or camera.get("green_mode") or "") or None

    baseline = _analyze(rgb, args, preferred_mode)
    shifted_rgb = shift_hue_hsi(rgb, args.known_shift)
    shifted = _analyze(shifted_rgb, args, preferred_mode)
    baseline_hue = float(baseline["estimate"]["estimated_hue"])
    shifted_hue = float(shifted["estimate"]["estimated_hue"])
    delta = (shifted_hue - baseline_hue) % 360.0

    jpeg_rows = []
    for quality in args.jpeg_quality:
        compressed = _jpeg_roundtrip(shifted_rgb, quality)
        compressed_result = _analyze(compressed, args, preferred_mode)
        compressed_hue = float(compressed_result["estimate"]["estimated_hue"])
        compressed_delta = (compressed_hue - baseline_hue) % 360.0
        jpeg_rows.append(
            {
                "quality": int(quality),
                "estimated_hue": compressed_hue,
                "delta_from_baseline": compressed_delta,
                "error_to_known_shift": angular_error(args.known_shift, compressed_delta),
                "analysis": _compact(compressed_result),
            }
        )

    result = {
        "raw_image": str(args.raw_image),
        "raw_metadata": raw_metadata,
        "camera": camera,
        "raw_camera_cfa_conflict": (
            bool(raw_metadata.get("green_mode") and camera.get("green_mode"))
            and raw_metadata.get("green_mode") != camera.get("green_mode")
        ),
        "options": {
            "backend": args.backend,
            "ds": args.ds,
            "block_size": args.block_size,
            "max_side": args.max_side,
            "cfa_green_mode": args.mode,
            "known_shift": args.known_shift,
            "preferred_mode": preferred_mode,
        },
        "baseline": _compact(baseline),
        "shifted": _compact(shifted),
        "delta_from_baseline": delta,
        "error_to_known_shift": angular_error(args.known_shift, delta),
        "jpeg_quality_sweep": jpeg_rows,
    }

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"raw_image              : {args.raw_image}")
        print(f"raw_backend            : {args.backend}")
        print(f"raw_bayer_pattern      : {raw_metadata.get('bayer_pattern') or 'unknown'}")
        print(f"raw_green_mode         : {raw_metadata.get('green_mode') or 'unknown'}")
        print(f"camera_lookup          : {camera.get('lookup_status')}")
        print(f"resolved_green_mode    : {baseline['options']['resolved_cfa_green_mode']}")
        print(f"baseline_hue           : {baseline_hue:.1f} deg")
        print(f"shifted_hue            : {shifted_hue:.1f} deg")
        print(f"delta_from_baseline    : {delta:.1f} deg")
        print(f"error_to_known_shift   : {angular_error(args.known_shift, delta):.1f} deg")
        if jpeg_rows:
            print("jpeg_quality_sweep     :")
            for row in jpeg_rows:
                print(
                    f"  q={row['quality']:<3} hue={row['estimated_hue']:.1f} "
                    f"delta={row['delta_from_baseline']:.1f} error={row['error_to_known_shift']:.1f}"
                )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
