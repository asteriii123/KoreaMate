import os
import tempfile
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, File, HTTPException, UploadFile
from faster_whisper import WhisperModel

MODEL_NAME = os.getenv("WHISPER_MODEL", "small")
app = FastAPI(title="KoreaMate Whisper", docs_url=None, redoc_url=None)
_model = None
_model_lock = Lock()
_inference_lock = Lock()


def model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                _model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
    return _model


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "loaded": _model is not None}


@app.post("/transcriptions")
def transcribe(audio: UploadFile = File(...)):
    suffix = Path(audio.filename or "audio.webm").suffix or ".webm"
    path = None
    try:
        with tempfile.NamedTemporaryFile(prefix="koreamate-voice-", suffix=suffix, delete=False) as temporary:
            path = temporary.name
            while chunk := audio.file.read(1024 * 1024):
                temporary.write(chunk)
        if not path or os.path.getsize(path) == 0:
            raise HTTPException(status_code=422, detail="SPEECH_EMPTY")
        with _inference_lock:
            segments, info = model().transcribe(path, beam_size=5, task="transcribe", vad_filter=True)
            text = " ".join(segment.text.strip() for segment in segments if segment.text.strip()).strip()
        if not text:
            raise HTTPException(status_code=422, detail="SPEECH_EMPTY")
        return {
            "text": text,
            "language": info.language,
            "languageProbability": round(float(info.language_probability), 4),
            "duration": round(float(info.duration), 2),
        }
    finally:
        audio.file.close()
        if path:
            Path(path).unlink(missing_ok=True)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=58020)
