"""
Text cleaning & normalization for JobShield AI.

Pipeline: strip HTML -> remove signatures/quoted replies -> normalize URLs/emails
-> normalize whitespace -> lowercase -> tokenize -> (optional) lemmatize.

NLTK resources are downloaded lazily and cached; if unavailable the code
degrades gracefully to regex tokenization without lemmatization.
"""
from __future__ import annotations

import html
import re
from functools import lru_cache
from typing import List

# ----------------------------------------------------------------------------
# Regex patterns (compiled once)
# ----------------------------------------------------------------------------
_HTML_TAG = re.compile(r"<[^>]+>")
_URL = re.compile(r"https?://\S+|www\.\S+", re.I)
_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
_MULTISPACE = re.compile(r"\s+")
_NON_ALNUM = re.compile(r"[^a-z0-9\s]")
# common signature / quoted-reply markers
_SIGNATURE = re.compile(
    r"(?:^--\s*$|^regards,|^best regards,|^thanks,|^thanks &|^sent from my|"
    r"^on .+wrote:|^-----original message-----)",
    re.I | re.M,
)


@lru_cache(maxsize=1)
def _lemmatizer():
    """Return an NLTK lemmatizer, downloading resources once; None on failure."""
    try:
        import nltk
        from nltk.stem import WordNetLemmatizer
        for res in ("wordnet", "omw-1.4"):
            try:
                nltk.data.find(f"corpora/{res}")
            except LookupError:
                nltk.download(res, quiet=True)
        return WordNetLemmatizer()
    except Exception:
        return None


def strip_html(text: str) -> str:
    text = html.unescape(text)
    return _HTML_TAG.sub(" ", text)


def remove_signatures(text: str) -> str:
    """Cut everything from the first signature/quoted-reply marker onward."""
    m = _SIGNATURE.search(text)
    return text[: m.start()] if m else text


def normalize_placeholders(text: str, keep_tokens: bool = True) -> str:
    """Replace URLs/emails with tokens so they survive cleaning as signals."""
    if keep_tokens:
        text = _URL.sub(" urltoken ", text)
        text = _EMAIL.sub(" emailtoken ", text)
    else:
        text = _URL.sub(" ", text)
        text = _EMAIL.sub(" ", text)
    return text


def tokenize(text: str) -> List[str]:
    return [t for t in text.split() if t]


def clean_text(
    text: str,
    *,
    remove_sig: bool = True,
    lowercase: bool = True,
    lemmatize: bool = True,
    keep_url_tokens: bool = True,
) -> str:
    """Full cleaning pipeline returning a normalized string."""
    if not isinstance(text, str):
        text = "" if text is None else str(text)
    text = strip_html(text)
    if remove_sig:
        text = remove_signatures(text)
    text = normalize_placeholders(text, keep_tokens=keep_url_tokens)
    if lowercase:
        text = text.lower()
    text = _NON_ALNUM.sub(" ", text)
    text = _MULTISPACE.sub(" ", text).strip()

    if lemmatize:
        lemm = _lemmatizer()
        if lemm is not None:
            text = " ".join(lemm.lemmatize(tok) for tok in tokenize(text))
    return text


def clean_series(texts, **kwargs):
    """Vectorized cleaning for a pandas Series / iterable of strings."""
    return [clean_text(t, **kwargs) for t in texts]
