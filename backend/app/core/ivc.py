from __future__ import annotations

import numpy as np

CHOI2011_CFA_IVC_REPOSITORY = "https://github.com/CyberHamster500/cfa-pattern-identification-ivc"
CHOI2011_CFA_IVC_DOI = "10.1145/2037252.2037258"


def intermediate_value_counts(channel: np.ndarray) -> np.ndarray:
    """Count non-intermediate pixels by 2x2 parity.

    This is the IVC primitive used in Choi, Choi, and Lee (2011),
    "CFA pattern identification of digital cameras using intermediate value
    counting." The 2013 hue-modification estimator extends this parity-based
    counting signal by evaluating it across hue-shift candidates.
    """

    values = channel.astype(np.float32)
    counts = np.zeros((2, 2), dtype=np.int64)
    if values.shape[0] < 3 or values.shape[1] < 3:
        return counts

    center = values[1:-1, 1:-1]
    top = values[:-2, 1:-1]
    bottom = values[2:, 1:-1]
    left = values[1:-1, :-2]
    right = values[1:-1, 2:]
    min_cross = np.minimum.reduce([top, bottom, left, right])
    max_cross = np.maximum.reduce([top, bottom, left, right])
    not_intermediate = (center < min_cross) | (center > max_cross)

    rows, cols = np.indices(center.shape)
    rows += 1
    cols += 1
    for row_parity in (0, 1):
        for col_parity in (0, 1):
            mask = not_intermediate & ((rows % 2) == row_parity) & ((cols % 2) == col_parity)
            counts[row_parity, col_parity] = int(mask.sum())
    return counts


# Backward-compatible name used by the 2013 hue-modification reproduction.
aivc_counts = intermediate_value_counts
