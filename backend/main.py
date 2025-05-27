from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.lib.auth_manager import init_db
from backend.lib.yaml_helpers import validate_packing_guidelines
from backend.routers import auth, boxes, floorplan, general, import_export, packing

# Initialize the authentication database
init_db()

# Validate packing guidelines on startup - dies if invalid
validate_packing_guidelines()

app = FastAPI(
    title="PackingWebsite API",
    description="API backend for packing optimization application",
    version="1.0.0"
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(general.router)
app.include_router(floorplan.router)
app.include_router(boxes.router)
app.include_router(auth.router)
app.include_router(auth.router_store)
app.include_router(packing.router)
app.include_router(import_export.router)
app.include_router(import_export.general_router)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}