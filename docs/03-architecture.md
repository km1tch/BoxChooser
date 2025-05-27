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

1. **Static Assets** (HTML, CSS, JS, images)
   - Client → Caddy → Filesystem
   - Served directly by Caddy with caching headers
   - No authentication required

2. **API Requests** (`/api/*`)
   - Client → Caddy → FastAPI
   - Proxied by Caddy to FastAPI backend
   - Authentication handled by FastAPI middleware

3. **Store Configuration** (YAML files)
   - Client → Caddy → FastAPI → Filesystem
   - Served through API with authentication
   - Allows for data filtering based on user role

## Services

### Caddy (Web Server)
- Serves all static frontend assets
- Reverse proxy for API requests
- Handles HTTPS termination
- Provides compression and caching

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
- Hot reload enabled for both services
- MailHog captures email for testing

### Production
- Caddy handles SSL/TLS termination
- FastAPI runs with production server (uvicorn)
- Real email service configured
- Database backups enabled