"""Canonical forms for identity fields.

Emails and domains are normalised once, at the data boundary (LeadInput and the
unsubscribe webhook), so dedupe and opt-out lookups always compare like with like.
Before this, ingest stored addresses as received while the unsubscribe webhook
lowercased them, so 'Jane.Doe@Acme.com' could never be unsubscribed.
"""

from urllib.parse import urlsplit


def normalize_email(value: str) -> str:
    """Trim and lowercase. The local part is technically case-sensitive, but no
    real mail provider treats it that way, and opt-outs must never be missed."""
    return value.strip().lower()


def normalize_domain(value: str) -> str:
    """'https://www.Acme.com/about' -> 'acme.com'."""
    raw = value.strip().lower()
    if "://" not in raw:
        raw = "//" + raw  # let urlsplit treat it as a netloc
    host = urlsplit(raw).hostname or ""
    host = host.rstrip(".")
    if host.startswith("www."):
        host = host[4:]
    return host
