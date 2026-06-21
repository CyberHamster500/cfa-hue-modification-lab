# CFA Hue Modification Estimation

[English README](README.md)

다음 논문의 재현 코드입니다.

> Chang-Hee Choi, Hae-Yeoun Lee, and Heung-Kyu Lee. "Estimation of color modification in digital images by CFA pattern change." Forensic Science International, 226(1-3), 94-105, 2013. DOI: 10.1016/j.forsciint.2012.12.014.

## 2011 CFA IVC 논문과의 관계

이 저장소는 2013년 hue modification 추정 논문을 재현합니다. 시기적으로 먼저 나온 2011년 CFA pattern identification 논문의 IVC 기반 방법을 확장한 구현입니다.

2011년 논문 재현 저장소:

https://github.com/CyberHamster500/cfa-pattern-identification-ivc

코드에서는 2011년 IVC primitive를 `backend/app/core/ivc.py`에 분리했습니다. 2013년 추정기는 이 primitive를 가져와 hue-shift 후보별 `Rr`, `Gr`, `Br` ratio curve를 계산합니다.

## 개요

구현 범위:

- RGB/HSI hue-shift 후보 생성
- RGB 채널별 IVC/AIVC counting
- `GXXG` / `XGGX` green CFA mode 처리
- EXIF 카메라 CFA lookup 및 RAW Bayer metadata fallback
- 이미지 단위 hue shift 추정
- block 단위 hue modification heatmap
- 단일 이미지 분석 CLI와 RAW ablation CLI
- 선택 사항인 FastAPI/React 데모

## 설치

Backend:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

선택 사항인 frontend demo:

```powershell
cd frontend
npm install
npm run dev
```

## CLI 사용

JPEG/PNG/RAW 이미지 분석:

```powershell
$env:PYTHONPATH="$PWD\backend"
python backend\scripts\analyze_image_cli.py path\to\image.jpg
```

RAW 파일 분석:

```powershell
$env:PYTHONPATH="$PWD\backend"
python backend\scripts\analyze_image_cli.py path\to\image.NEF --ds 10
```

전체 JSON 출력:

```powershell
$env:PYTHONPATH="$PWD\backend"
python backend\scripts\analyze_image_cli.py path\to\image.jpg --ds 5 --block-size 64 --json
```

주요 옵션:

- `--ds`: hue search step. 기본값은 `10`.
- `--block-size`: heatmap block size. 기본값은 `128`.
- `--max-side`: 분석 전 resize longest side. 기본값은 `768`.
- `--mode`: `AUTO`, `GXXG`, `XGGX`. 기본값은 `AUTO`.

## 테스트

```powershell
cd backend
python -m pytest
```

## 인용

이 저장소를 사용할 때는 2013년 논문과 기반이 되는 2011년 논문을 함께 인용해 주세요.
