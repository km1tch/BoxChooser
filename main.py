import os

from fastapi import FastAPI, HTTPException, Path
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from lib.auth_manager import init_db
from lib.yaml_helpers import validate_packing_guidelines
from routers import auth, boxes, floorplan, general, import_export, packing, static

# Initialize the authentication database
init_db()

# Validate packing guidelines on startup - dies if invalid
validate_packing_guidelines()

app = FastAPI()

# Include routers
app.include_router(static.router)
app.include_router(general.router)
app.include_router(floorplan.router)
app.include_router(boxes.router)
app.include_router(auth.router)
app.include_router(auth.router_store)
app.include_router(packing.router)
app.include_router(import_export.router)
app.include_router(import_export.general_router)

# Mount static directories
app.mount("/assets", StaticFiles(directory="assets"), name="assets")
app.mount("/lib", StaticFiles(directory="lib"), name="lib")
app.mount("/components", StaticFiles(directory="components"), name="components")

# Define dynamic routes
@app.get("/", response_class=HTMLResponse)
async def root():
    """
    Root route - show a page that checks for any stored tokens via JavaScript
    and redirects appropriately
    """
    html_content = """
<!DOCTYPE html>
<html>
<head>
    <title>Redirecting...</title>
    <script src="/lib/auth.js"></script>
    <script>
        // Check localStorage for any store tokens
        function findStoredToken() {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('store_') && key.endsWith('_token')) {
                    // Extract store ID from key: store_X_token
                    const match = key.match(/store_(\d+)_token/);
                    if (match) {
                        const storeId = match[1];
                        const token = localStorage.getItem(key);
                        if (token) {
                            return { storeId, token };
                        }
                    }
                }
            }
            return null;
        }
        
        // Check for existing authentication
        window.onload = async function() {
            const tokenInfo = findStoredToken();
            
            if (tokenInfo) {
                // Found a token, verify it's still valid
                try {
                    const response = await fetch(`/api/auth/status?store_id=${tokenInfo.storeId}`, {
                        headers: {
                            'Authorization': `Bearer ${tokenInfo.token}`
                        }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.isAuthenticated) {
                            // Valid token, redirect to store
                            window.location.href = `/${tokenInfo.storeId}`;
                            return;
                        }
                    }
                } catch (error) {
                    console.error('Error checking auth:', error);
                }
            }
            
            // No valid token found, redirect to login
            window.location.href = '/login';
        };
    </script>
</head>
<body>
    <p>Redirecting...</p>
</body>
</html>
"""
    return HTMLResponse(content=html_content)


# Login page route - must come before pattern-matching routes
@app.get("/login", response_class=HTMLResponse)
async def login_page_root():
    with open("login.html", "r") as f:
        return HTMLResponse(f.read())


# Store-specific login page route
@app.get("/{store_id}/login", response_class=HTMLResponse)
async def login_page(store_id: str = Path(..., regex=r"^\d{1,4}$")):
    # Check if the store's YAML file exists
    yaml_file = f"stores/store{store_id}.yml"
    if not os.path.exists(yaml_file):
        raise HTTPException(status_code=404, detail=f"Store configuration not found for store {store_id}")
        
    # Load the login HTML
    with open("login.html", "r") as f:
        return HTMLResponse(f.read())


# Catch-all pattern should be last to avoid conflicts
@app.get("/{store_id}", response_class=HTMLResponse)
async def store_page(store_id: str = Path(..., regex=r"^\d{1,4}$")):
    with open("index.html", "r") as f:
        return f.read()


@app.get("/{store_id}/price_editor", response_class=HTMLResponse)
async def price_editor(store_id: str = Path(..., regex=r"^\d{1,4}$")):
    # Check if the store's YAML file exists
    yaml_file = f"stores/store{store_id}.yml"
    if not os.path.exists(yaml_file):
        raise HTTPException(status_code=404, detail=f"Store configuration not found for store {store_id}")

    # Load the price editor HTML
    with open("price_editor.html", "r") as f:
        html_content = f.read()
    
    # Add cache-busting headers with the response
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }

    return HTMLResponse(content=html_content, headers=headers)


# New route structure for admin pages - all protected by auth
@app.get("/{store_id}/prices", response_class=HTMLResponse)
async def prices_page(
    store_id: str = Path(..., regex=r"^\d{1,4}$")
):
    # Forward to existing price_editor for now
    # Eventually this will point to admin/prices/index.html
    return await price_editor(store_id)


@app.get("/{store_id}/floorplan", response_class=HTMLResponse)
async def floorplan_page(
    store_id: str = Path(..., regex=r"^\d{1,4}$")
):
    # Check if the store's YAML file exists
    yaml_file = f"stores/store{store_id}.yml"
    if not os.path.exists(yaml_file):
        raise HTTPException(status_code=404, detail=f"Store configuration not found for store {store_id}")

    # Load the floorplan HTML
    with open("floorplan.html", "r") as f:
        return HTMLResponse(f.read())


@app.get("/{store_id}/wizard", response_class=HTMLResponse)
async def wizard_page(store_id: str = Path(..., regex=r"^\d{1,4}$")):
    # Check if the store's YAML file exists
    yaml_file = f"stores/store{store_id}.yml"
    if not os.path.exists(yaml_file):
        raise HTTPException(status_code=404, detail=f"Store configuration not found for store {store_id}")

    # Load the wizard HTML
    with open("wizard.html", "r") as f:
        return HTMLResponse(f.read())


@app.get("/{store_id}/import", response_class=HTMLResponse)
async def import_page(store_id: str = Path(..., regex=r"^\d{1,4}$")):
    # Check if the store's YAML file exists
    yaml_file = f"stores/store{store_id}.yml"
    if not os.path.exists(yaml_file):
        raise HTTPException(status_code=404, detail=f"Store configuration not found for store {store_id}")

    # Load the import HTML
    with open("import.html", "r") as f:
        return HTMLResponse(f.read())


@app.get("/{store_id}/settings", response_class=HTMLResponse)
async def settings_admin_page(store_id: str = Path(..., regex=r"^\d{1,4}$")):
    # Check if the store's YAML file exists
    yaml_file = f"stores/store{store_id}.yml"
    if not os.path.exists(yaml_file):
        raise HTTPException(status_code=404, detail=f"Store configuration not found for store {store_id}")

    # Load the settings HTML
    with open("settings.html", "r") as f:
        return HTMLResponse(f.read())