import math
import os
from threading import Lock

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

MODEL_ID = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
MODEL_VERSION = os.getenv("EMBEDDING_MODEL_VERSION", "master")
MODEL_CACHE_DIR = os.getenv("EMBEDDING_MODEL_CACHE", "") or None
DIMENSIONS = 1024
MAX_BATCH_SIZE = 32
MAX_TEXT_LENGTH = 4096

app = FastAPI(title="KoreaMate Embedding", docs_url=None, redoc_url=None)
_model = None
_device = "not-loaded"
_model_lock = Lock()
_inference_lock = Lock()


class EmbedRequest(BaseModel):
    texts: list[str]


def embedding_model():
    global _model, _device
    if _model is None:
        with _model_lock:
            if _model is None:
                from modelscope import snapshot_download
                from FlagEmbedding import BGEM3FlagModel
                import torch

                path = snapshot_download(
                    MODEL_ID,
                    revision=MODEL_VERSION,
                    cache_dir=MODEL_CACHE_DIR,
                )
                _device = "cuda" if torch.cuda.is_available() else "cpu"
                _model = BGEM3FlagModel(
                    path,
                    use_fp16=torch.cuda.is_available(),
                    devices=_device,
                )
    return _model


def validated_texts(texts: list[str]) -> list[str]:
    if not texts or len(texts) > MAX_BATCH_SIZE:
        raise ValueError("EMBEDDING_BATCH_INVALID")
    cleaned = [text.strip() for text in texts]
    if any(not text or len(text) > MAX_TEXT_LENGTH for text in cleaned):
        raise ValueError("EMBEDDING_TEXT_INVALID")
    return cleaned


def normalized_vector(values) -> list[float]:
    vector = values.tolist() if hasattr(values, "tolist") else list(values)
    if len(vector) != DIMENSIONS or any(not math.isfinite(float(value)) for value in vector):
        raise ValueError("EMBEDDING_VECTOR_INVALID")
    norm = math.sqrt(sum(float(value) ** 2 for value in vector))
    if norm == 0:
        raise ValueError("EMBEDDING_VECTOR_INVALID")
    return [float(value) / norm for value in vector]


def embed_texts(texts: list[str]) -> list[list[float]]:
    cleaned = validated_texts(texts)
    with _inference_lock:
        output = embedding_model().encode(
            cleaned,
            batch_size=min(len(cleaned), 12),
            max_length=1024,
            return_dense=True,
            return_sparse=False,
            return_colbert_vecs=False,
        )
    vectors = output.get("dense_vecs") if isinstance(output, dict) else None
    if vectors is None or len(vectors) != len(cleaned):
        raise ValueError("EMBEDDING_VECTOR_INVALID")
    return [normalized_vector(vector) for vector in vectors]


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_ID,
        "modelVersion": MODEL_VERSION,
        "dimensions": DIMENSIONS,
        "device": _device,
        "loaded": _model is not None,
    }


@app.post("/embed")
def embed(request: EmbedRequest):
    try:
        vectors = embed_texts(request.texts)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=503, detail="EMBEDDING_UNAVAILABLE") from error
    return {
        "model": MODEL_ID,
        "modelVersion": MODEL_VERSION,
        "dimensions": DIMENSIONS,
        "vectors": vectors,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=58030)
