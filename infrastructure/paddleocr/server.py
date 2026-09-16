import argparse
import base64
import json
import os
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
                    text_detection_model_name="PP-OCRv5_server_det",
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
    lines = []
    for result in engine().predict(image):
        data = result.json["res"]
        texts = data.get("rec_texts", [])
        scores = data.get("rec_scores", [])
        boxes = data.get("rec_boxes", [])
        for index, text in enumerate(texts):
            if not text or not text.strip():
                continue
            lines.append({
                "text": text.strip(),
                "confidence": round(float(scores[index]) if index < len(scores) else 0, 3),
                "box": boxes[index].tolist() if index < len(boxes) and hasattr(boxes[index], "tolist") else (boxes[index] if index < len(boxes) else None),
            })
    confidence = sum(line["confidence"] for line in lines) / len(lines) if lines else 0
    return json.dumps({"text": "\n".join(line["text"] for line in lines), "confidence": round(confidence, 3), "lines": lines}, ensure_ascii=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=58010, type=int)
    args = parser.parse_args()
    mcp.run(transport="http", host=args.host, port=args.port)
