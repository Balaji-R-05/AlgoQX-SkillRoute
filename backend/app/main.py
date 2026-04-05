import os
import sys
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
import traceback

# Add the parent directory to sys.path to allow absolute imports when run directly
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

from app.config import PROJECT_NAME, ENV
from app.routes.career import router as career_router
from app.routes.students import router as students_router
from app.routes.progress import router as progress_router
from app.routes.quiz import router as quiz_router
from app.routes.jobs import router as jobs_router
from app.routes.resources import router as resources_router
from app.routes.schedules import router as schedules_router
from app.routes.wellness import router as wellness_router
from app.routes.interviews import router as interviews_router
from app.routes.teaching import router as teaching_router

app = FastAPI(
    title=PROJECT_NAME,
    description="SkillRoute – Stress-aware academic command center for exams & placements",
    version="2.0.0"
)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "https://skillroute.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Global Exception Handler to ensure CORS headers are always present
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_msg = str(exc)
    print(f"CRITICAL ERROR on {request.url.path}: {error_msg}")
    traceback.print_exc()
    
    # Return 500 but with ALL CORS headers manually since middleware might be bypassed
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": error_msg}
    )
    
    # Force add CORS headers for the frontend origin
    origin = request.headers.get("origin")
    if origin in origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "*"
        
    return response

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_content = {"detail": exc.errors(), "body": exc.body}
    print(f"VALIDATION ERROR on {request.url.path}: {error_content}")
    
    response = JSONResponse(
        status_code=422,
        content=error_content
    )
    
    origin = request.headers.get("origin")
    if origin in origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        
    return response

app.include_router(career_router)
app.include_router(students_router)
app.include_router(progress_router)
app.include_router(quiz_router)
app.include_router(jobs_router)
app.include_router(resources_router, prefix="/api")
app.include_router(schedules_router)
app.include_router(wellness_router)
app.include_router(interviews_router)
app.include_router(teaching_router)

@app.get("/")
def root():
    return {
        "app": PROJECT_NAME,
        "env": ENV,
        "status": "running"
    }

@app.get("/health")
def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)