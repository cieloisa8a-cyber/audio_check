import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from .reports import build_report
from .schemas import CalibrationProfile, ReportRequest


PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIR = PROJECT_ROOT / "frontend"
STATIC_DIR = FRONTEND_DIR / "static"

app = FastAPI(title="Audio Check", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def calibration_profiles() -> tuple[CalibrationProfile, ...]:
    config = json.loads((STATIC_DIR / "calibration-profiles.json").read_text(encoding="utf-8"))
    if config.get("version") != 1 or not isinstance(config.get("profiles"), list):
        raise ValueError("El catálogo de perfiles acústicos tiene un formato no válido.")
    profiles = tuple(CalibrationProfile.parse_obj(item) for item in config["profiles"])
    keys = {(profile.platform, profile.id) for profile in profiles}
    if len(keys) != len(profiles):
        raise ValueError("El catálogo contiene identificadores de perfil duplicados.")
    return profiles


@app.get("/manifest.webmanifest", include_in_schema=False)
def manifest() -> FileResponse:
    return FileResponse(
        STATIC_DIR / "manifest.webmanifest",
        media_type="application/manifest+json",
    )


@app.get("/sw.js", include_in_schema=False)
def service_worker() -> FileResponse:
    return FileResponse(
        STATIC_DIR / "sw.js",
        media_type="application/javascript",
        headers={"Service-Worker-Allowed": "/", "Cache-Control": "no-cache"},
    )


@app.post("/api/report.pdf", include_in_schema=False)
def report(request: ReportRequest) -> Response:
    if request.calibration_profile not in calibration_profiles():
        raise HTTPException(status_code=422, detail="El perfil acústico no está aprobado en este despliegue.")
    pdf_bytes = build_report(request)
    filename = "Audiometria.pdf"
    if request.patient_name:
        normalized = unicodedata.normalize("NFKD", request.patient_name.strip()).encode("ASCII", "ignore").decode("utf-8")
        safe_name = re.sub(r"[^a-zA-Z0-9_-]+", "_", normalized).strip("_")
        if safe_name:
            filename = f"Audiometria_{safe_name}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "application/pdf",
        },
    )


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
