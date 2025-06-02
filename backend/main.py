from typing import Optional
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.lib.auth_manager import init_db
from backend.lib.yaml_helpers import validate_packing_guidelines
from backend.lib.rate_limiter import limiter
from backend.lib.auth_middleware import get_optional_auth_with_demo
from backend.lib.rate_limit_dedup import cleanup_old_attempts
from backend.routers import auth, boxes, catalog, floorplan, general, import_export, packing, superadmin, vendors

# Initialize the authentication database
init_db()

# Validate packing guidelines on startup - dies if invalid
validate_packing_guidelines()


async def cleanup_rate_limit_task():
    """Background task to clean up old rate limit attempts"""
    while True:
        try:
            # Clean up attempts older than 5 minutes
            deleted = cleanup_old_attempts(minutes=5)
            if deleted > 0:
                print(f"Cleaned up {deleted} old rate limit attempts")
        except Exception as e:
            print(f"Error in rate limit cleanup task: {e}")
        
        # Run every 5 minutes
        await asyncio.sleep(300)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan - startup and shutdown tasks"""
    # Startup
    cleanup_task = asyncio.create_task(cleanup_rate_limit_task())
    
    yield
    
    # Shutdown
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="PackingWebsite API",
    description="API backend for packing optimization application",
    version="1.0.0",
    lifespan=lifespan
)

# Add rate limiter to app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
app.include_router(superadmin.router)
app.include_router(catalog.router)
app.include_router(vendors.router)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.get("/api/status")
async def get_status(
    auth_info: Optional[dict] = get_optional_auth_with_demo()
):
    """Get current authentication status"""
    if auth_info:
        return {
            "authenticated": True,
            "storeId": auth_info['store_id'],
            "authLevel": auth_info['auth_level'],
            "isDemo": auth_info.get('is_demo', False)
        }
    
    return {
        "authenticated": False,
        "storeId": None,
        "authLevel": None,
        "isDemo": False
    }