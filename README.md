# CFA Hue Modification Estimation

[Korean README](README-ko.md)

Reference implementation for:

> Chang-Hee Choi, Hae-Yeoun Lee, and Heung-Kyu Lee. "Estimation of color modification in digital images by CFA pattern change." Forensic Science International, 226(1-3), 94-105, 2013. DOI: 10.1016/j.forsciint.2012.12.014.

## Relationship To The 2011 CFA IVC Work

This repository reproduces the 2013 hue-modification estimator as an extension of the earlier CFA pattern identification work:

> Chang-Hee Choi, Jung-Ho Choi, and Heung-Kyu Lee. "CFA pattern identification of digital cameras using intermediate value counting." MM&Sec '11, 21-26, 2011. DOI: 10.1145/2037252.2037258.

The 2011 reproduction is maintained separately:

https://github.com/CyberHamster500/cfa-pattern-identification-ivc

In code, the 2011 IVC primitive is isolated in `backend/app/core/ivc.py`. The 2013 estimator imports that primitive and extends it by applying hue-shift candidates and measuring the resulting `Rr`, `Gr`, and `Br` ratio curves.

## Overview

The 2013 method estimates color modification by exploiting CFA interpolation traces that change after hue rotation. This implementation provides:

- RGB/HSI hue-shift candidate generation;
- IVC/AIVC counting over RGB channels;
- `GXXG` / `XGGX` green CFA mode handling;
- EXIF camera CFA lookup and RAW Bayer metadata fallback;
- image-level hue shift estimation;
- block-level hue modification heatmap;
- CLI tools for single-image analysis and RAW ablation;
- optional FastAPI/React demo interface.

## Installation

Backend:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Optional frontend demo:

```powershell
cd frontend
npm install
npm run dev
```

## CLI Usage

Analyze one JPEG/PNG/RAW image:

```powershell
$env:PYTHONPATH="$PWD\backend"
python backend\scripts\analyze_image_cli.py path\to\image.jpg
```

RAW files are developed with `rawpy`/LibRaw before analysis:

```powershell
$env:PYTHONPATH="$PWD\backend"
python backend\scripts\analyze_image_cli.py path\to\image.NEF --ds 10
```

Full JSON output:

```powershell
$env:PYTHONPATH="$PWD\backend"
python backend\scripts\analyze_image_cli.py path\to\image.jpg --ds 5 --block-size 64 --json
```

Main options:

- `--ds`: hue-search step in degrees. Default: `10`.
- `--block-size`: heatmap block size in pixels. Default: `128`.
- `--max-side`: resize longest side before analysis. Default: `768`.
- `--mode`: `AUTO`, `GXXG`, or `XGGX`. Default: `AUTO`.

## RAW Ablation

```powershell
$env:PYTHONPATH="$PWD\backend"
python backend\scripts\raw_ablation_cli.py path\to\image.NEF --known-shift 120 --ds 10
```

JPEG quality sweep:

```powershell
$env:PYTHONPATH="$PWD\backend"
python backend\scripts\raw_ablation_cli.py path\to\image.NEF --known-shift 120 --jpeg-quality 95 85 70 50
```

## Dresden-Style Smoke Test

```powershell
$env:PYTHONPATH="$PWD\backend"
python backend\scripts\run_dresden_smoke.py <DATASET_ROOT> --per-camera 1 --max-side 384 --ds 30 --known-shift 120
```

The smoke test applies a known synthetic hue shift and reports the estimated delta relative to the original image estimate.

## API Demo

Backend:

```powershell
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd frontend
npm run dev
```

Open `http://127.0.0.1:5173`.

## Repository Structure

- `backend/app/core/ivc.py`: 2011 IVC primitive used as the base counting signal.
- `backend/app/core/hue.py`: 2013 hue-shift estimation logic.
- `backend/app/core/camera_metadata.py`: camera CFA lookup and green-mode mapping.
- `backend/app/core/raw_develop.py`: RAW development and RAW Bayer metadata extraction.
- `backend/scripts/analyze_image_cli.py`: single-image CLI.
- `backend/scripts/raw_ablation_cli.py`: RAW and JPEG-quality ablation CLI.
- `backend/scripts/run_dresden_smoke.py`: Dresden-style batch smoke test.

## Tests

```powershell
cd backend
python -m pytest
```

## Notes

- Research PDFs and datasets are not stored in this repository.
- `local_raw_samples/`, `frontend/dist/`, `node_modules/`, and Python cache files are not commit targets.
- The CLI path is the primary reproduction surface; the GUI is only an optional inspection demo.

## Citation

```bibtex
@article{choi2013estimation,
  title = {Estimation of color modification in digital images by CFA pattern change},
  author = {Choi, Chang-Hee and Lee, Hae-Yeoun and Lee, Heung-Kyu},
  journal = {Forensic Science International},
  volume = {226},
  number = {1-3},
  pages = {94--105},
  year = {2013},
  publisher = {Elsevier},
  doi = {10.1016/j.forsciint.2012.12.014}
}

@inproceedings{choi2011cfa,
  title = {CFA pattern identification of digital cameras using intermediate value counting},
  author = {Choi, Chang-Hee and Choi, Jung-Ho and Lee, Heung-Kyu},
  booktitle = {Proceedings of the thirteenth ACM multimedia workshop on Multimedia and security},
  pages = {21--26},
  year = {2011},
  publisher = {ACM},
  doi = {10.1145/2037252.2037258}
}
```

## License

MIT
