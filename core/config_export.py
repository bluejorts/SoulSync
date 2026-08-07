"""Config export/import — one portable bundle (Kazimir's "checkout" menu for
migrating installs).

A SoulSync install's settings live in the ``config.json`` the config_manager
owns (connections, download sources, enrichment, organization…). This
assembles it into a single JSON bundle so a reinstall/migration is one
export → one import.

Secrets (API keys, tokens, passwords) are REDACTED by default — the export
is safe to share/store. ``include_secrets=True`` embeds the real values for
a true one-click migration; the caller (endpoint + UI) gates that behind an
explicit opt-in + warning because the file is then plaintext credentials.

Pure assembly + a strict validator; the endpoint owns request/response and
the actual config writes. No web_server imports.
"""

from __future__ import annotations

from typing import Any, Dict, Tuple

from utils.logging_config import get_logger

logger = get_logger("config_export")

BUNDLE_MARKER = "soulsync_config_export"
BUNDLE_VERSION = 1


def build_bundle(config_manager, *, include_secrets: bool,
                 exported_at: str, app_version: str = "") -> Dict[str, Any]:
    """Assemble the portable config bundle. ``exported_at``/``app_version`` are
    passed in (no clock/global reads here). Music config is the full decrypted
    dict when ``include_secrets`` else the redacted one."""
    music = (config_manager.get_full_config() if include_secrets
             else config_manager.redacted_config())
    return {
        BUNDLE_MARKER: True,
        "bundle_version": BUNDLE_VERSION,
        "app_version": app_version,
        "exported_at": exported_at,
        "includes_secrets": bool(include_secrets),
        "music": music,
    }


def validate_bundle(data: Any) -> Tuple[bool, str]:
    """Is ``data`` a SoulSync config bundle we can import? Returns (ok, reason)."""
    if not isinstance(data, dict):
        return False, "Not a JSON object."
    if not data.get(BUNDLE_MARKER):
        return False, "This file isn't a SoulSync config export."
    ver = data.get("bundle_version")
    if not isinstance(ver, int) or ver > BUNDLE_VERSION:
        return False, "This export was made by a newer SoulSync; update first."
    if not isinstance(data.get("music"), dict):
        return False, "The export is missing its music section."
    return True, ""


def apply_bundle(config_manager, data: Dict[str, Any]) -> Dict[str, Any]:
    """Apply a validated bundle to this install. Music config merges through the
    config_manager (its set() already ignores round-tripped REDACTED masks, so
    importing a secrets-redacted bundle never blanks an existing secret).
    Returns a small summary."""
    ok, reason = validate_bundle(data)
    if not ok:
        raise ValueError(reason)
    music_keys = config_manager.apply_config_dict(data.get("music") or {})
    return {"music_keys": music_keys}


__all__ = ["BUNDLE_MARKER", "BUNDLE_VERSION", "build_bundle",
           "validate_bundle", "apply_bundle"]
