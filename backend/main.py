from typing import Optional
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.lib.auth_manager import init_db
from backend.lib.yaml_helpers import validate_packing_guidelines
from backend.lib.rate_limiter import limiter
from backend.lib.auth_middleware import get_optional_auth_with_demo
from backend.lib.rate_limit_dedup import cleanup_old_attempts
from backend.routers import auth, boxes, floorplan, general, import_export, library, packing

# Set up logging
logger = logging.getLogger(__name__)

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
                logger.info(f"Cleaned up {deleted} old rate limit attempts")
        except Exception as e:
            # Log the error but continue running
            logger.error(f"Rate limit cleanup error: {e}")
        
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
    title="BoxChooser API",
    description="API backend for packing optimization application",
    version="1.0.0",
    lifespan=lifespan
)

# Add rate limiter to app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS is handled by Caddy at the proxy level
# No need for CORS middleware in FastAPI

# Include routers
app.include_router(general.router)
app.include_router(floorplan.router)
app.include_router(boxes.router)
app.include_router(auth.router)
app.include_router(auth.router_store)
app.include_router(packing.router)
app.include_router(import_export.router)
app.include_router(import_export.general_router)
app.include_router(library.router)

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