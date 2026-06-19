from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from app.core.camera_metadata import extract_exif_camera, lookup_camera_cfa
from app.core.hue import angular_error, estimate_cfa_green_mode, estimate_from_curves, load_rgb_image, ratio_curves, shift_hue_hsi


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a quick CFA hue-shift smoke test on Dresden-style JPG folders.")
    parser.add_argument("dataset", type=Path, help="Dataset root, for example Z:\\Dresden_Exp")
    parser.add_argument("--per-camera", type=int, default=1, help="Number of JPG files to sample per camera folder.")
    parser.add_argument("--max-side", type=int, default=384, help="Resize longest side before analysis.")
    parser.add_argument("--ds", type=int, default=30, help="Hue search step in degrees.")
    parser.add_argument("--known-shift", type=int, default=120, help="Synthetic hue shift applied for validation.")
    parser.add_argument("--mode", choices=["GXXG", "XGGX"], default="GXXG", help="Green CFA mode.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    files: list[Path] = []
    for folder in sorted(path for path in args.dataset.iterdir() if path.is_dir()):
        files.extend(sorted(folder.glob("*.JPG"))[: args.per_camera])

    started = time.time()
    rows = []
    for path in files:
        data = path.read_bytes()
        camera = lookup_camera_cfa(extract_exif_camera(data))
        rgb = load_rgb_image(data, max_side=args.max_side)
        image_prediction = estimate_cfa_green_mode(rgb)
        mode = str(camera["green_mode"] or image_prediction["mode"] or args.mode)
        shifted = shift_hue_hsi(rgb, args.known_shift)
        original_estimate = estimate_from_curves(ratio_curves(rgb, args.ds), mode)  # type: ignore[arg-type]
        shifted_estimate = estimate_from_curves(ratio_curves(shifted, args.ds), mode)  # type: ignore[arg-type]
        original_hue = float(original_estimate["estimated_hue"])
        shifted_hue = float(shifted_estimate["estimated_hue"])
        delta = (shifted_hue - original_hue) % 360.0
        rows.append(
            {
                "camera": path.parent.name,
                "file": path.name,
                "exif_make": camera["make"],
                "exif_model": camera["model"],
                "bayer_pattern": camera["bayer_pattern"],
                "green_mode": mode,
                "green_mode_source": "camera_spec" if camera["green_mode"] else "image_estimate",
                "image_estimate_confidence": round(float(image_prediction["confidence"]) * 100, 2),
                "image_estimate_reliability": image_prediction["reliability"],
                "cfa_lookup_status": camera["lookup_status"],
                "size": f"{rgb.shape[1]}x{rgb.shape[0]}",
                "original_estimated_hue": round(original_hue, 1),
                "shifted_estimated_hue": round(shifted_hue, 1),
                "delta": round(delta, 1),
                "error_to_known_shift": round(angular_error(args.known_shift, delta), 1),
            }
        )

    errors = [row["error_to_known_shift"] for row in rows]
    summary = {
        "dataset": str(args.dataset),
        "files": len(rows),
        "mode": args.mode,
        "ds": args.ds,
        "known_shift": args.known_shift,
        "max_side": args.max_side,
        "elapsed_sec": round(time.time() - started, 2),
        "mean_error": round(sum(errors) / max(len(errors), 1), 2),
        "exact_or_step_error": sum(1 for error in errors if error <= args.ds),
        "rows": rows,
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
