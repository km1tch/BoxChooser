from fastapi import APIRouter
from fastapi.responses import HTMLResponse, FileResponse

router = APIRouter(tags=["static"])


@router.get("/index.js", response_class=HTMLResponse)
async def base_script():
    # Add cache-busting headers
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    with open("index.js", "r") as f:
        return HTMLResponse(f.read(), media_type="text/javascript", headers=headers)


@router.get("/pricing.js", response_class=HTMLResponse)
async def pricing_script():
    # Serve pricing module from lib/pricing.js
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    with open("lib/pricing.js", "r") as f:
        return HTMLResponse(f.read(), media_type="text/javascript", headers=headers)


@router.get("/packing.js", response_class=HTMLResponse)
async def packing_script():
    # Serve packing module from lib/packing.js
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    with open("lib/packing.js", "r") as f:
        return HTMLResponse(f.read(), media_type="text/javascript", headers=headers)


@router.get("/api.js", response_class=HTMLResponse)
async def api_script():
    # Serve api module from lib/api.js
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    with open("lib/api.js", "r") as f:
        return HTMLResponse(f.read(), media_type="text/javascript", headers=headers)


@router.get("/location.js", response_class=HTMLResponse)
async def location_script():
    # Serve location module from lib/location.js
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    with open("lib/location.js", "r") as f:
        return HTMLResponse(f.read(), media_type="text/javascript", headers=headers)


@router.get("/packing-rules.js", response_class=HTMLResponse)
async def packing_rules_script():
    # Serve packing rules module from lib/packing-rules.js
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    with open("lib/packing-rules.js", "r") as f:
        return HTMLResponse(f.read(), media_type="text/javascript", headers=headers)


@router.get("/favicon.ico", response_class=FileResponse)
async def favicon():
    return FileResponse("assets/favicon.ico")