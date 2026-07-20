"""
Input extraction utilities: PDF offer letters and screenshot OCR.

Both dependencies are optional; functions raise a clear error only when the
relevant input type is used without the library installed.
"""
from __future__ import annotations

from pathlib import Path


def extract_pdf_text(path_or_bytes) -> str:
    """Extract text from a PDF file path or bytes using pdfplumber."""
    try:
        import io
        import pdfplumber
    except ImportError as e:
        raise RuntimeError("pdfplumber not installed: pip install pdfplumber") from e

    src = path_or_bytes
    if isinstance(path_or_bytes, (bytes, bytearray)):
        import io
        src = io.BytesIO(path_or_bytes)
    text_parts = []
    with pdfplumber.open(src) as pdf:
        for page in pdf.pages:
            text_parts.append(page.extract_text() or "")
    return "\n".join(text_parts).strip()


def extract_image_text(path_or_bytes) -> str:
    """OCR text from a screenshot/image using pytesseract + Pillow."""
    try:
        import io
        import pytesseract
        from PIL import Image
    except ImportError as e:
        raise RuntimeError(
            "OCR needs pytesseract + Pillow and the Tesseract binary") from e

    src = path_or_bytes
    if isinstance(path_or_bytes, (bytes, bytearray)):
        import io
        src = io.BytesIO(path_or_bytes)
    img = Image.open(src)
    return pytesseract.image_to_string(img).strip()
