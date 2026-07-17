"""
Document parsing: extract raw text from uploaded resume PDF/DOCX.
Ported from AI_Resume_Agent/app/parser.py.
"""
import io


def parse_resume(file_bytes: bytes, filename: str) -> str:
    """Return raw text from a PDF or DOCX resume."""
    fname = (filename or "").lower()
    if fname.endswith(".pdf"):
        return _parse_pdf(file_bytes)
    elif fname.endswith(".docx"):
        return _parse_docx(file_bytes)
    else:
        raise ValueError("Unsupported file type. Upload a .pdf or .docx resume.")


def _parse_pdf(file_bytes: bytes) -> str:
    try:
        import pypdf
    except ImportError:
        raise RuntimeError("pypdf is not installed. pip install pypdf")
    reader = pypdf.PdfReader(io.BytesIO(file_bytes))
    parts = []
    for page in reader.pages:
        txt = page.extract_text() or ""
        parts.append(txt)
    return "\n".join(parts)


def _parse_docx(file_bytes: bytes) -> str:
    try:
        import docx
    except ImportError:
        raise RuntimeError("python-docx is not installed. pip install python-docx")
    document = docx.Document(io.BytesIO(file_bytes))
    parts = [p.text for p in document.paragraphs if p.text.strip()]
    # also pull tables (common in resumes)
    for table in document.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells:
                parts.append(" | ".join(cells))
    return "\n".join(parts)
