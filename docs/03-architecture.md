# Application Architecture

## Overview

BoxChooser uses a modern web architecture with clear separation between frontend static assets and backend API services.

## Directory Structure

```
BoxChooser/
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
├── vendors/            # Vendor box catalogs (YAML)
├── db/                 # SQLite database
├── tools/              # Management utilities
├── docker-compose.yaml # Multi-container setup
└── Caddyfile          # Caddy web server config
```

## Technology Stack

### Frontend

- **Vanilla JavaScript** - ES6 modules, no framework dependencies
- **CSS3** - Responsive design with CSS Grid and Flexbox
- **Vitest** - JavaScript testing framework
- **No build step** - Direct browser-native modules

### Backend

- **FastAPI** - Modern Python web framework
- **SQLite** - Lightweight database for auth and settings
- **YAML** - Human-readable configuration format
- **Python 3.8+** - Type hints and modern features

### Infrastructure

- **Docker & Docker Compose** - Containerized deployment
- **Caddy** - Modern web server with automatic HTTPS
- **Alpine Linux** - Minimal container base images

## Request Flow

### Production Environment

1. **HTTPS Request**

   - Client → Host Reverse Proxy (port 443) → Docker Caddy (port 5893) → FastAPI/Filesystem
   - Host Proxy handles SSL termination and real IP forwarding
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
   - Vendor catalogs from `vendors/*.yml` via `/api/vendors/*`
   - All require authentication - YAML files never served directly

### Development Environment

- Direct access via ports 5893 (HTTP) and 5443 (HTTPS)
- No host proxy needed
- Simplified configuration for local development

## Services

### Docker Caddy (Web Server)

- Serves all static frontend assets
- Reverse proxy for API requests to FastAPI
- Provides compression and caching
- Handles CORS and security headers
- In production: receives HTTP from host reverse proxy
- In development: direct access on ports 5893/5443

### FastAPI (API Backend)

- RESTful API endpoints
- Authentication and authorization (see [Authentication API Patterns](authentication-api-patterns.md))
- Database operations
- YAML file access with auth checks
- Business logic processing
- Logging with Python logging module

### Database (SQLite)

- User authentication data
- Session management
- Audit logs
- Custom packing rules per store
- Superadmin accounts

## Authentication Flow

1. User accesses `/{store_id}` route
2. Caddy serves the static HTML/JS
3. JavaScript checks authentication via API
4. If not authenticated, redirects to login
5. PIN/email authentication handled by FastAPI
6. Session cookie set for subsequent requests

## API Design Principles

### Consistent Patterns

- All store-specific endpoints follow `/api/store/{store_id}/*` pattern
- Authentication via Bearer tokens in Authorization header
- JSON request/response bodies
- Proper HTTP status codes (401, 403, 404, etc.)

### Rate Limiting

- Email endpoints: 10 requests per hour per store
- General API: Configurable limits

### Error Handling

- Consistent error response format
- Detailed messages for debugging (dev only)
- Generic messages for production

## Security Considerations

- Static assets are public (no sensitive data)
- All API endpoints require authentication except:
  - `/health` - Health check
  - `/api/status` - Auth status check
  - `/api/auth/*` - Login endpoints
- Store configurations filtered based on user role
- YAML files never served directly to prevent data exposure
- Session cookies are httpOnly and secure
- Input validation on all API endpoints
- SQL injection prevention via parameterized queries

## Development vs Production

### Development

- Caddy and FastAPI run in Docker containers
- Frontend files mounted as volumes for hot reload
- Backend hot reload enabled via uvicorn --reload
- MailHog captures email for testing
- No cache busting (use browser dev tools)
- Verbose error messages

### Production

- Frontend files baked into Caddy Docker image
- Cache busting applied during build (timestamp in filenames)
- No hot reload - immutable container images
- Host proxy handles SSL/TLS termination on the Alpine host
- Docker Caddy receives plain HTTP on localhost:5893
- FastAPI runs with production server (uvicorn)
- Real email service configured
- Rate limiting sees real client IPs via forwarded headers
- Generic error messages for security

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

## Data Storage

### YAML Files

- **Store configurations** (`stores/store{id}.yml`) - Box inventory and settings
- **Packing guidelines** (`stores/packing_guidelines.yml`) - Default rules
- **Vendor catalogs** (`vendors/*.yml`) - Importable box definitions

### Database Tables

- `store_auth` - Store authentication credentials
- `email_verifications` - Temporary email verification codes
- `sessions` - Active user sessions
- `audit_log` - Security and change tracking
- `custom_packing_rules` - Store-specific rule overrides
- `superadmins` - System administrator accounts

### File Storage

- **Floorplan images** (`floorplans/`) - PNG/JPG store layouts
- **Frontend assets** (`frontend/assets/`) - CSS, JS, images

## Scalability Considerations

### Current Limitations

- SQLite database (single writer)
- File-based configuration storage
- Single-node deployment

### Future Scaling Options

- PostgreSQL/MySQL for concurrent writes
- Redis for session storage
- S3/object storage for floorplans, stores, vendors
- Multi-node deployment with load balancer
- API-based configuration management

## Monitoring and Observability

### Logging

- Python logging module for backend
- Structured logs with appropriate levels
- Caddy access logs for request tracking

### Health Checks

- `/health` endpoint for uptime monitoring
- Database connectivity checks
- SMTP connectivity validation (admin panel)
