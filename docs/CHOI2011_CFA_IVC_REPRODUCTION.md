# Choi et al. 2011 CFA IVC Reproduction

Target paper:

> Choi, C.-H., Choi, J.-H., and Lee, H.-K. (2011). CFA pattern identification of digital cameras using intermediate value counting. MM&Sec '11, pages 21-26. DOI: 10.1145/2037252.2037258.

## Scope

This reproduction uses the IVC/AIVC implementation already built for the hue-modification reproduction and exposes it as the earlier CFA-pattern-identification experiment.

The implemented target is:

- estimate the Bayer CFA pattern from an RGB image using intermediate value counting;
- score the four Bayer candidates: `RGGB`, `BGGR`, `GBRG`, `GRBG`;
- report the derived green-mode group used by the later hue paper: `XGGX` or `GXXG`;
- compare the prediction against EXIF/curated camera lookup and RAW container metadata when available.

## Implementation

Core implementation:

- `backend/app/core/hue.py`: existing `aivc_counts` implementation.
- `backend/app/core/cfa_ivc.py`: 2011-paper wrapper that scores Bayer candidates from IVC counts.
- `backend/scripts/identify_cfa_cli.py`: command-line reproduction entrypoint.
- `backend/tests/test_cfa_ivc.py`: focused synthetic checks for payload shape, candidate set, and confidence range.

The scoring step normalizes each channel's 2x2 parity IVC counts and sums the candidate-aligned positions:

```text
score(pattern) = sum normalized_count[channel_at_pattern_position, parity_position]
```

The candidate with the largest score is reported as the estimated Bayer pattern. Confidence is the relative margin between the best and second-best candidate.

## Usage

From the repository root:

```powershell
$env:PYTHONPATH="$PWD\backend"
python backend\scripts\identify_cfa_cli.py path\to\image.jpg
```

For RAW files:

```powershell
$env:PYTHONPATH="$PWD\backend"
python backend\scripts\identify_cfa_cli.py path\to\image.NEF
```

Full JSON output:

```powershell
$env:PYTHONPATH="$PWD\backend"
python backend\scripts\identify_cfa_cli.py path\to\image.jpg --json
```

## Verification

Run:

```powershell
cd backend
pytest
```

## Notes

ACM blocks direct PDF download from this environment, so this implementation is based on the DOI metadata and the already-reproduced IVC/AIVC code used in the later hue-modification project. If the original PDF is added locally, the exact table and figure reproduction can be tightened against the paper's experimental settings.
