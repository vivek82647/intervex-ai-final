"""
File Text Extractor - PDF, Images, Word Docs (no paid API needed)
"""
import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)


async def extract_text_from_file(content: bytes, filename: str) -> str:
    """Extract text from PDF, image, or docx file"""
    fname = filename.lower()

    if fname.endswith('.pdf'):
        return _extract_pdf(content)
    elif fname.endswith(('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff')):
        return _extract_image(content)
    elif fname.endswith(('.docx', '.doc')):
        return _extract_docx(content)
    elif fname.endswith('.txt'):
        return content.decode('utf-8', errors='ignore')
    else:
        raise ValueError(f"Unsupported file type: {filename}. Use PDF, image (JPG/PNG), DOCX, or TXT.")


def _extract_pdf(content: bytes) -> str:
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(content))
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        if not text.strip():
            raise ValueError("PDF has no extractable text (scanned PDF). Please use an image instead.")
        return text.strip()
    except ImportError:
        raise ValueError("PDF support not available. Please use TXT or DOCX.")
    except Exception as e:
        if "no extractable" in str(e):
            raise
        raise ValueError(f"PDF extraction failed: {str(e)}")


def _extract_image(content: bytes) -> str:
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(io.BytesIO(content))
        text = pytesseract.image_to_string(img)
        if not text.strip():
            raise ValueError("No text found in image. Make sure the image contains readable text.")
        return text.strip()
    except ImportError:
        raise ValueError("Image OCR not available on this server. Please use PDF or DOCX instead.")
    except Exception as e:
        if "No text found" in str(e):
            raise
        raise ValueError(f"Image extraction failed: {str(e)}")


def _extract_docx(content: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(content))
        text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        if not text.strip():
            raise ValueError("DOCX file appears to be empty.")
        return text.strip()
    except ImportError:
        raise ValueError("DOCX support not available. Please use TXT instead.")
    except Exception as e:
        if "empty" in str(e):
            raise
        raise ValueError(f"DOCX extraction failed: {str(e)}")
