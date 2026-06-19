# Camera CFA Pattern Notes

The app reads EXIF `Make` and `Model` from uploaded JPEG/PNG files and tries to resolve a known Bayer CFA pattern from a conservative local lookup table. If no known entry exists, the backend falls back to image-based AIVC parity estimation and reports confidence.

## Lookup Policy

1. Read EXIF camera metadata.
2. Normalize make/model strings.
3. Match against the curated camera CFA table in `backend/app/core/camera_metadata.py`.
4. Convert full Bayer pattern to green CFA mode:
   - `RGGB`, `BGGR` -> `XGGX`
   - `GBRG`, `GRBG` -> `GXXG`
5. If no known spec exists, use image-based Auto CFA estimation and show confidence.

## Curated Entries

| Camera | Bayer pattern | Green mode | Source |
| --- | --- | --- | --- |
| Nikon D200 | `RGGB` | `XGGX` | Choi et al. 2013; Siegen multi-illuminant dataset paper |
| Nikon D70 | `BGGR` | `XGGX` | Choi et al. 2013; Choi et al. 2011 |
| Nikon D70s | `BGGR` | `XGGX` | Choi et al. 2013; Choi et al. 2011 |
| Nikon D90 | `GBRG` | `GXXG` | Choi et al. 2013 |
| Canon EOS 500D | `RGGB` | `XGGX` | Choi et al. 2013 |
| Sony DSLR-A380 | `RGGB` | `XGGX` | Choi et al. 2013 |
| Olympus E-420 | `RGGB` | `XGGX` | Choi et al. 2013 |

## References

- Choi, C.-H., Lee, H.-Y., & Lee, H.-K. (2013). *Estimation of color modification in digital images by CFA pattern change*. Forensic Science International, 226(1-3), 94-105. DOI: `10.1016/j.forsciint.2012.12.014`.
- Choi, C.-H., Choi, J.-H., & Lee, H.-K. (2011). *CFA pattern identification of digital cameras using intermediate value counting*. ACM Multimedia and Security.
- Design and Creation of a Multi-illuminant Scene Image Dataset, which explicitly notes the Nikon D200 CFA pattern as `RGGB`.
- `dcraw -i -v` / LibRaw-style RAW inspection can be used to expand this table for additional models when RAW files are available.

## Important Caveat

JPEG EXIF usually does not contain `CFAPattern` or `CFARepeatPatternDim`; those tags are generally absent from in-camera JPEG files. For unknown cameras, the app reports the image-estimated mode with confidence instead of pretending a spec lookup succeeded.

