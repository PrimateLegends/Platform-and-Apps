"""Signature hygiene for signed market actions.

Every ECDSA signature (r, s) has a twin (r, N - s) that verifies for the same message and key. If both were
accepted, a used signature could be replayed once as its twin, because a replay check keyed on the signature
bytes sees a new value. Only the low-s form (s <= N / 2) is accepted, so each action has one valid encoding.
"""
from __future__ import annotations

from .errors import MarketError

# Order of the secp256k1 group (written as 2**256 minus a constant).
N = 2**256 - 432420386565659656852420866394968145599
HALF_N = N // 2


def split(signature: str) -> tuple[int, int, int]:
    """'0x' + r (32 bytes) + s (32 bytes) + v (1 byte) -> (r, s, v)."""
    raw = signature[2:] if signature.startswith("0x") else signature
    if len(raw) != 130:
        raise MarketError("bad-signature")
    try:
        r, s, v = int(raw[:64], 16), int(raw[64:128], 16), int(raw[128:], 16)
    except ValueError:
        raise MarketError("bad-signature") from None
    if not (0 < r < N and 0 < s < N) or v not in (0, 1, 27, 28):
        raise MarketError("bad-signature")
    return r, s, v


def is_low_s(signature: str) -> bool:
    return split(signature)[1] <= HALF_N


def require_low_s(signature: str) -> None:
    """Raises MarketError('bad-signature') for a high-s (malleated) signature."""
    if not is_low_s(signature):
        raise MarketError("bad-signature")


def twin(signature: str) -> str:
    """The malleated twin of a signature: s -> N - s and the recovery bit flipped. Used by tests and audits."""
    r, s, v = split(signature)
    flipped = {0: 1, 1: 0, 27: 28, 28: 27}[v]
    return "0x%064x%064x%02x" % (r, N - s, flipped)
