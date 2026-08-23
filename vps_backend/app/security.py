"""Password hashing and session-token helpers.

Deliberately dependency-free: hashlib.scrypt is a memory-hard KDF in
the Python standard library, which keeps the deployment footprint
identical while resisting GPU cracking far better than a bare SHA
round. Stored format:

    scrypt$<N>$<r>$<p>$<salt_hex>$<hash_hex>
"""
import hashlib
import hmac
import secrets

_SCRYPT_N = 2 ** 14  # CPU/memory cost
_SCRYPT_R = 8        # block size
_SCRYPT_P = 1        # parallelization
_DKLEN = 32
_SALT_BYTES = 16


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(_SALT_BYTES)
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_DKLEN,
    )
    return (
        f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}"
        f"${salt.hex()}${digest.hex()}"
    )


def verify_password(password: str, stored: str) -> bool:
    """Constant-time verification; returns False on any malformed input."""
    try:
        scheme, n, r, p, salt_hex, hash_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = bytes.fromhex(hash_hex)
        computed = hashlib.scrypt(
            password.encode("utf-8"),
            salt=bytes.fromhex(salt_hex),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(computed, expected)


def new_session_token() -> tuple[str, str]:
    """Return (raw_token, token_hash) — only the hash gets stored."""
    raw = secrets.token_urlsafe(32)
    return raw, _sha256(raw)


def hash_token(raw_token: str) -> str:
    return _sha256(raw_token)


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()
