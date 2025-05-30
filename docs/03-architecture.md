# Application Architecture

## Overview

PackingWebsite uses a modern web architecture with clear separation between frontend static assets and backend API services.

## Directory Structure

```
/zpool/dev/PackingWebsite/
├── backend/              # Python FastAPI backend
│   ├── main.py          # Application entry point
│   ├── models/          # SQLAlchemy models
│   ├── routers/         # API route handlers
│   └── lib/             # Python utility libraries
├── frontend/            # Static assets (served by Caddy)
│   ├── *.html          # HTML pages
│   ├── assets/         # CSS, images, favicon
│   │   ├── css/        # Stylesheets
│   │   ├── icons/      # Images and icons
│   │   └── floorplans/ # Store floorplan images
│   ├── js/             # JavaScript modules
│   │   ├── index.js    # Main application entry
│   │   ├── components/ # UI components
│   │   └── lib/        # JavaScript libraries
│   └── tests/          # Frontend test suite
├── stores/             # Store configuration (YAML)
├── db/                 # SQLite database
├── docker-compose.yaml # Multi-container setup
└── Caddyfile          # Caddy web server config
```

## Request Flow

### Production Environment
1. **HTTPS Request**
   - Client → Host Caddy (port 443) → Docker Caddy (port 5893) → FastAPI/Filesystem
   - Host Caddy handles SSL termination and real IP forwarding
   - Docker Caddy receives plain HTTP with trusted headers

2. **Static Assets** (HTML, CSS, JS, images)
   - Served directly by Docker Caddy with caching headers
   - No authentication required

3. **API Requests** (`/api/*`)
   - Proxied by Docker Caddy to FastAPI backend
   - Authentication handled by FastAPI middleware
   - Rate limiting uses real client IPs from headers

4. **Store Data** (served by FastAPI, not directly exposed)
   - Store configurations from `stores/*.yml` accessed via `/api/store/{id}/boxes`, `/api/store/{id}/pricing_mode`, etc.
   - Floorplan images from `floorplans/` served at `/api/store/{id}/floorplan`
   - Packing guidelines from `stores/packing_guidelines.yml` at `/api/packing-guidelines`
   - All require authentication - YAML files never served directly

### Development Environment
- Direct access via ports 5893 (HTTP) and 5443 (HTTPS)
- No host proxy needed
- Simplified configuration for local development

## Services

### Caddy (Web Server)

#### Host Caddy (Production Only)
- Handles SSL/TLS termination with Let's Encrypt
- Forwards real client IPs via headers
- Strips incoming forwarded headers to prevent spoofing
- Minimal configuration for security and performance

#### Docker Caddy
- Serves all static frontend assets
- Reverse proxy for API requests to FastAPI
- Provides compression and caching
- Handles CORS and security headers
- In production: receives HTTP from host Caddy
- In development: direct access on ports 5893/5443

### FastAPI (API Backend)
- RESTful API endpoints
- Authentication and authorization
- Database operations
- YAML file access with auth checks
- Business logic processing

### Database (SQLite)
- User authentication data
- Session management
- Audit logs (future)

## Authentication Flow

1. User accesses `/{store_id}` route
2. Caddy serves the static HTML/JS
3. JavaScript checks authentication via API
4. If not authenticated, redirects to login
5. PIN/email authentication handled by FastAPI
6. Session cookie set for subsequent requests

## Security Considerations

- Static assets are public (no sensitive data)
- All API endpoints require authentication
- Store configurations filtered based on user role
- YAML files never served directly to prevent data exposure
- Session cookies are httpOnly and secure

## Development vs Production

### Development
- Caddy and FastAPI run in Docker containers
- Frontend files mounted as volumes for hot reload
- Backend hot reload enabled via uvicorn --reload
- MailHog captures email for testing
- No cache busting (use browser dev tools)

### Production
- Frontend files baked into Caddy Docker image
- Cache busting applied during build (timestamp in filenames)
- No hot reload - immutable container images
- Host Caddy handles SSL/TLS termination on the Alpine host
- Docker Caddy receives plain HTTP on localhost:5893
- FastAPI runs with production server (uvicorn)
- Real email service configured
- Database backups enabled
- Rate limiting sees real client IPs via forwarded headers

## Cache Busting Strategy

Production builds implement automatic cache busting:

1. **Build Process**:
   - Frontend files copied into Caddy container
   - Shell script renames all CSS/JS files with timestamps
   - HTML references updated to match new filenames
   - Example: `common.css` → `common.1748630573.css`

2. **Benefits**:
   - Guaranteed fresh assets after deployments
   - Long cache headers (1 year) for optimal performance
   - No manual version tracking needed
   - Zero runtime overhead

3. **Implementation**:
   - Uses only Alpine Linux built-in tools (sh, sed, find)
   - Runs during `docker-compose build`
   - Similar approach to PML/printmylabel project