import argparse
import base64
import json
import os
import hashlib
from threading import Lock

# PaddlePaddle's Windows oneDNN backend cannot execute one attribute shape used by
# the Korean PP-OCRv5 model. Disable it before PaddleOCR imports PaddlePaddle.
os.environ.setdefault("PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT", "False")
os.environ.setdefault("FLAGS_use_mkldnn", "0")

import cv2
import numpy as np
from fastmcp import FastMCP
from paddleocr import PaddleOCR

mcp = FastMCP("KoreaMate Korean OCR")
_engine = None
_lock = Lock()


def engine():
    global _engine
    if _engine is None:
        with _lock:
            if _engine is None:
                _engine = PaddleOCR(
                    text_detection_model_name="PP-OCRv5_mobile_det",
                    text_recognition_model_name="korean_PP-OCRv5_mobile_rec",
                    use_doc_orientation_classify=False,
                    use_doc_unwarping=False,
                    use_textline_orientation=False,
                    device="cpu",
                )
    return _engine


@mcp.tool
def ocr(input_data: str) -> str:
    """Extract Korean and English text from a Base64 image or data URL."""
    payload = input_data.split(",", 1)[1] if input_data.startswith("data:") else input_data
    raw = base64.b64decode(payload, validate=True)
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Invalid image data")
    height, width = image.shape[:2]
    scale = min(1.0, 1280 / max(height, width), (1_600_000 / (height * width)) ** 0.5)
    if scale < 1:
        image = cv2.resize(image, (max(1, round(width * scale)), max(1, round(height * scale))), interpolation=cv2.INTER_AREA)
    image = np.ascontiguousarray(image)
    lines = []
    for result in engine().predict(image):
        data = result.json["res"]
        texts = data.get("rec_texts", [])
        scores = data.get("rec_scores", [])
        polygons = data.get("rec_polys", [])
        for index, text in enumerate(texts):
            if not text or not text.strip():
                continue
            lines.append({
                "lineId": hashlib.sha256(f"{index}:{text.strip()}".encode("utf-8")).hexdigest()[:16],
                "text": text.strip(),
                "confidence": round(float(scores[index]) if index < len(scores) else 0, 3),
                "polygon": polygons[index].tolist() if index < len(polygons) and hasattr(polygons[index], "tolist") else (polygons[index] if index < len(polygons) else None),
            })
    confidence = sum(line["confidence"] for line in lines) / len(lines) if lines else 0
    return json.dumps({"text": "\n".join(line["text"] for line in lines), "confidence": round(confidence, 3), "width": int(image.shape[1]), "height": int(image.shape[0]), "lines": lines}, ensure_ascii=False)


def warm_up():
    """Load the model and run one inference before serving traffic.

    PaddleOCR lazy-loads its detection and recognition models and compiles the
    PaddlePaddle C++ extensions on first use. That cold start can take several
    minutes, which is long enough to time out the API's first few requests and
    surface a misleading "OCR service interrupted" error. Warming up here keeps
    the first real request fast.
    """
    print("[koreamate-ocr] warming up model (first run may take a few minutes)…", flush=True)
    model = engine()
    blank = np.full((64, 64, 3), 255, dtype=np.uint8)
    for _ in model.predict(blank):
        pass
    print("[koreamate-ocr] warm up complete", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=58010, type=int)
    args = parser.parse_args()
    warm_up()
    mcp.run(transport="http", host=args.host, port=args.port)
