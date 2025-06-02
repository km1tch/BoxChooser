# Authentication System Overview

The Packing Website uses a two-tier authentication system providing role-based access control. This document covers the system architecture, login flows, and database schema.

## Authentication Levels

### 1. No Authentication
- Redirected to login page
- Only login page and static assets accessible

### 2. Legacy Mode
- Stores with YAML but no auth setup
- Only packing calculator (`/{store_id}/`) accessible
- No navigation menu or modern features
- Backward compatibility during migration

### 3. User Authentication (PIN-based)
- **For**: Point-of-sale staff
- **Login**: 6-digit PIN
- **Access**: Read-only operations
  - Box selection wizard
  - Packing calculator
  - Price viewer (no editing)

### 4. Admin Authentication (Email-based)
- **For**: Store managers
- **Login**: Email verification code
- **Access**: Full read/write
  - All user features
  - Price editing
  - Excel import/export
  - Store settings
  - Floorplan editor

## Database Schema

SQLite database with these tables:

### store_auth
```sql
store_id      TEXT PRIMARY KEY  -- e.g., "1", "2"
admin_email   TEXT NOT NULL
pin_hash      TEXT NOT NULL     -- bcrypt hash
created_at    TIMESTAMP
updated_at    TIMESTAMP
```

### email_codes
```sql
id            INTEGER PRIMARY KEY
store_id      TEXT NOT NULL
email         TEXT NOT NULL
code          TEXT NOT NULL     -- 6-char alphanumeric
expires_at    TIMESTAMP         -- 5 minutes
used          BOOLEAN DEFAULT 0
created_at    TIMESTAMP
```

### sessions
```sql
token         TEXT PRIMARY KEY
store_id      TEXT NOT NULL
auth_level    TEXT NOT NULL     -- "user", "admin", or "superadmin"
expires_at    TIMESTAMP         -- 24 hours
created_at    TIMESTAMP
```

### audit_log
```sql
id            INTEGER PRIMARY KEY
store_id      TEXT
action        TEXT NOT NULL
details       TEXT              -- JSON data
timestamp     TIMESTAMP
```

## Login Flows

### User Login (PIN)
1. Navigate to `/login`
2. Select "Point-of-Sale" mode
3. Enter store number and 6-digit PIN
4. System validates and creates user session
5. Redirect to wizard page

### Admin Login (Email)
1. Navigate to `/login`
2. Select "Back Office Admin" mode
3. Enter store number and admin email
4. System sends verification code via email
5. Enter 6-character code (5 minute expiry)
6. System validates and creates admin session
7. Redirect with full access

## Session Management

- **Storage**: Browser localStorage
- **Token Format**: Cryptographically secure random string
- **Expiration**: 24 hours
- **Per-Store**: Sessions isolated by store

## Email Configuration

Set environment variables for SMTP:

```bash
# Development (MailHog)
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_USE_TLS=false
SMTP_FROM=noreply@packingsite.com

# Production (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USE_TLS=true
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com
```

Development includes MailHog:
- SMTP: `localhost:1025`
- Web UI: `http://localhost:8026`

## PIN Management

- **Format**: 6 digits (000000-999999)
- **Generation**: Cryptographically random
- **Storage**: bcrypt hash with salt
- **Regeneration**: Via CLI or settings page
- **No recovery**: Must regenerate if lost

CLI commands:
```bash
./tools/auth create {store_id} {admin_email}
./tools/auth regenerate-pin {store_id}
```

## Frontend Integration

Core authentication library: `/js/lib/auth.js`

### Key Functions
```javascript
// Protect pages
await AuthManager.requireAuth(storeId, adminRequired);

// Check status
const status = await AuthManager.getAuthStatus(storeId);

// Logout
AuthManager.logout(storeId);
```

### Automatic Features
- Token included in API requests
- Redirect on 401 responses
- Navigation adapts to auth level

## Security Features

- bcrypt hashed PINs with salt
- Single-use email codes
- 5-minute code expiration
- 24-hour session expiration
- Comprehensive audit logging
- Per-store isolation

## API Authentication

See [authentication-api-patterns.md](authentication-api-patterns.md) for backend implementation patterns.

## Superadmin System

See [superadmin-system.md](superadmin-system.md) for the separate superadmin authentication system.