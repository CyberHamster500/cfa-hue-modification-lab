from __future__ import annotations

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.camera_metadata import extract_exif_camera, lookup_camera_cfa
from app.core.hue import AnalysisOptions, analyze_image, generate_synthetic_sample, image_to_data_url, load_rgb_image
from app.core.raw_develop import develop_raw_bytes_with_rawpy, is_supported_raw_filename
from PIL import Image

app = FastAPI(title="CFA Hue Modification Reproduction", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):5173$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze(
    file: UploadFile = File(...),
    ds: int = Form(5),
    block_size: int = Form(32),
    cfa_green_mode: str = Form("AUTO"),
) -> JSONResponse:
    if cfa_green_mode not in {"AUTO", "GXXG", "XGGX"}:
        return JSONResponse({"detail": "cfa_green_mode must be AUTO, GXXG, or XGGX"}, status_code=400)
    if ds < 1 or ds > 45:
        return JSONResponse({"detail": "ds must be between 1 and 45"}, status_code=400)
    if block_size < 16 or block_size > 256:
        return JSONResponse({"detail": "block_size must be between 16 and 256"}, status_code=400)

    data = await file.read()
    try:
        camera = lookup_camera_cfa(extract_exif_camera(data))
    except Exception:
        camera = {
            "make": "",
            "model": "",
            "software": "",
            "normalized_key": "",
            "bayer_pattern": None,
            "green_mode": None,
            "source": "EXIF camera metadata could not be read; using image or RAW metadata fallback",
            "source_url": None,
            "lookup_status": "unknown",
        }
    raw_metadata = None
    developed_preview = None
    input_kind = "raw" if is_supported_raw_filename(file.filename or "") else "rgb"
    if input_kind == "raw":
        try:
            rgb, raw_metadata = develop_raw_bytes_with_rawpy(data, suffix=f".{(file.filename or 'raw').split('.')[-1]}")
        except RuntimeError as exc:
            return JSONResponse({"detail": str(exc)}, status_code=500)
        except Exception as exc:
            return JSONResponse({"detail": f"RAW development failed: {exc}"}, status_code=400)
        preview_image = Image.fromarray(rgb, "RGB")
        developed_preview = image_to_data_url(preview_image)
    else:
        rgb = load_rgb_image(data)

    preferred_mode = None
    if cfa_green_mode == "AUTO":
        preferred_mode = str((raw_metadata or {}).get("green_mode") or camera["green_mode"] or "") or None
    result = analyze_image(
        rgb,
        AnalysisOptions(
            ds=ds,
            block_size=block_size,
            cfa_green_mode=cfa_green_mode,  # type: ignore[arg-type]
            preferred_cfa_green_mode=preferred_mode,  # type: ignore[arg-type]
        ),
    )
    if input_kind == "raw" and cfa_green_mode == "AUTO" and raw_metadata and raw_metadata.get("green_mode"):
        result["options"]["cfa_resolution_source"] = "raw_pattern"
    result["camera"] = camera
    result["input_kind"] = input_kind
    result["raw_metadata"] = raw_metadata
    result["raw_camera_cfa_conflict"] = (
        bool(raw_metadata and raw_metadata.get("green_mode") and camera.get("green_mode"))
        and raw_metadata.get("green_mode") != camera.get("green_mode")
    )
    if developed_preview:
        result["developed_preview"] = developed_preview
    return JSONResponse(result)


@app.post("/api/generate-sample")
def generate_sample(hue_shift: int = Form(120)) -> dict[str, str | int]:
    source, annotated = generate_synthetic_sample(hue_shift=hue_shift)
    return {
        "hue_shift": int(hue_shift % 360),
        "image": image_to_data_url(source),
        "annotated": image_to_data_url(annotated),
    }
