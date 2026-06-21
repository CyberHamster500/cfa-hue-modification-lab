from io import BytesIO

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

from app.core.camera_metadata import bayer_to_green_mode, lookup_camera_cfa, normalize_camera_key
from app.core.hue import (
    AnalysisOptions,
    aivc_counts,
    analyze_image,
    estimate_from_curves,
    estimate_cfa_green_mode,
    generate_synthetic_sample,
    shift_hue_hsi,
)
from app.core.ivc import CHOI2011_CFA_IVC_DOI, intermediate_value_counts
from app.main import app


def test_hue_shift_rotates_primary_colors() -> None:
    rgb = np.array([[[255, 0, 0], [0, 255, 0], [0, 0, 255]]], dtype=np.uint8)
    shifted = shift_hue_hsi(rgb, 120)
    assert shifted[0, 0, 1] > 240
    assert shifted[0, 1, 2] > 240
    assert shifted[0, 2, 0] > 240


def test_aivc_counts_reflect_checkerboard_positions() -> None:
    channel = np.tile(np.arange(12, dtype=np.uint8), (12, 1)) + 90
    rows, cols = np.indices(channel.shape)
    channel[((rows % 2) == 0) & ((cols % 2) == 0)] = 240
    counts = aivc_counts(channel)
    assert np.array_equal(counts, intermediate_value_counts(channel))
    assert CHOI2011_CFA_IVC_DOI == "10.1145/2037252.2037258"
    assert counts[0, 0] > max(counts[0, 1], counts[1, 0], counts[1, 1])


def test_estimation_uses_expected_green_pattern_extrema() -> None:
    curves = [
        {"shift": 0.0, "R": 1.1, "G": 1.2, "B": 0.9},
        {"shift": 120.0, "R": 1.2, "G": 1.8, "B": 1.0},
        {"shift": 240.0, "R": 0.8, "G": 0.7, "B": 1.6},
    ]
    assert estimate_from_curves(curves, "GXXG")["estimated_hue"] == 240.0
    assert estimate_from_curves(curves, "XGGX")["estimated_hue"] == 120.0


def test_known_camera_cfa_lookup_resolves_green_mode() -> None:
    camera = {
        "make": "NIKON CORPORATION",
        "model": "NIKON D200",
        "software": "",
        "normalized_key": normalize_camera_key("NIKON CORPORATION", "NIKON D200"),
    }
    spec = lookup_camera_cfa(camera)
    assert spec["lookup_status"] == "known"
    assert spec["bayer_pattern"] == "RGGB"
    assert spec["green_mode"] == "XGGX"
    assert bayer_to_green_mode("GBRG") == "GXXG"


def test_cfa_green_mode_prediction_reports_mode_and_confidence() -> None:
    rgb = np.full((24, 24, 3), 128, dtype=np.uint8)
    rows, cols = np.indices(rgb.shape[:2])
    rgb[..., 1] = np.tile(np.arange(24, dtype=np.uint8), (24, 1)) + 90
    rgb[..., 1][((rows % 2) == 0) & ((cols % 2) == 0)] = 230
    prediction = estimate_cfa_green_mode(rgb)
    assert prediction["mode"] == "GXXG"
    assert float(prediction["confidence"]) > 0.1


def test_synthetic_sample_produces_block_heatmap() -> None:
    image, _ = generate_synthetic_sample(hue_shift=120)
    rgb = np.asarray(image, dtype=np.uint8)
    result = analyze_image(rgb, AnalysisOptions(ds=10, block_size=64, cfa_green_mode="AUTO"))
    cells = [cell for row in result["heatmap"] for cell in row]
    assert cells
    assert result["options"]["resolved_cfa_green_mode"] in {"GXXG", "XGGX"}
    assert "confidence" in result["cfa_prediction"]
    assert max(cell["confidence"] for cell in cells) > 0.01


def test_api_analyze_returns_curves_and_heatmap() -> None:
    client = TestClient(app)
    image, _ = generate_synthetic_sample(hue_shift=120)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    response = client.post(
        "/api/analyze",
        data={"ds": "10", "block_size": "64", "cfa_green_mode": "AUTO"},
        files={"file": ("sample.png", buffer.getvalue(), "image/png")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["curves"]
    assert body["heatmap"]
    assert "estimated_hue" in body["estimate"]
    assert body["cfa_prediction"]["mode"] in {"GXXG", "XGGX"}
