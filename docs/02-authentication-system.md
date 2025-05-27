# Authentication System Guide

## Overview

The Packing Website uses a two-tier authentication system that provides role-based access control for different types of users. This ensures sensitive operations like price editing are restricted to administrators while allowing store associates to access the tools they need.

## Authentication Levels

### 1. No Authentication
Users who haven't logged in are redirected to the login page. Only the login page and static assets (CSS, JS, images) are accessible without authentication.

### 2. Legacy Mode
Stores that have a YAML configuration file but haven't set up authentication operate in legacy mode:
- Only the packing calculator (`/{store_id}/`) is accessible
- No navigation menu or modern features
- Designed for backward compatibility during migration

### 3. User Authentication (PIN-based)
Store associates use a 6-digit PIN for day-to-day operations:
- **Access Level**: Read-only
- **Available Features**:
  - Box selection wizard - Simplified interface for finding the right box
  - Packing calculator - Traditional box selection tool  
  - Price viewer - View current prices (no editing)
- **Use Case**: Point-of-sale staff who need to help customers

### 4. Admin Authentication (Email-based)
Managers and administrators use email verification for full access:
- **Access Level**: Full read/write
- **Available Features**:
  - All user features plus:
  - Price editor - Update box prices
  - Excel import/export - Bulk price management
  - Store settings - Configure packing rules and recommendation engine
  - Floorplan editor - Map box locations visually
- **Use Case**: Store managers who need to maintain pricing and configuration

## Database Schema

The authentication system uses SQLite with the following tables:

### store_auth
Stores authentication configuration for each store:
- `store_id`: The store identifier (e.g., "1", "2")
- `admin_email`: Email address for admin access
- `pin_hash`: Bcrypt hash of the 6-digit PIN for user access
- `created_at`: When authentication was set up
- `updated_at`: Last modification time

### email_codes
Temporary verification codes for admin login:
- `id`: Auto-incrementing primary key
- `store_id`: Which store this code is for
- `email`: Email address the code was sent to
- `code`: 6-character alphanumeric code (e.g., "A7K9P2")
- `expires_at`: Expiration time (5 minutes after creation)
- `used`: Whether the code has been used
- `created_at`: When the code was generated

### sessions
Active authentication sessions:
- `token`: Unique session identifier
- `store_id`: Which store this session is for
- `auth_level`: Either "user" or "admin"
- `expires_at`: When the session expires (24 hours)
- `created_at`: When the session was created

### audit_log
Tracks all authentication events for security:
- `id`: Auto-incrementing primary key
- `store_id`: Which store this event relates to
- `action`: Type of event (login attempt, logout, etc.)
- `details`: JSON data with additional context
- `timestamp`: When the event occurred

## Login Process

The system uses a single login page (`/login`) with a toggle between user and admin modes.

### User Login Flow (PIN)
1. Navigate to `/login`
2. Select "Point-of-Sale" mode (default)
3. Enter store number
4. Enter 6-digit PIN
5. System validates PIN and creates user session
6. Redirect to wizard page

### Admin Login Flow (Email)
1. Navigate to `/login`  
2. Select "Back Office Admin" mode
3. Enter store number
4. Enter admin email address
5. System sends verification code to email
6. Enter 6-character code (expires in 5 minutes)
7. System validates code and creates admin session
8. Redirect to appropriate page with full access

## Route Protection

Routes are protected using decorators and middleware that check authentication status and access levels.

### Python Decorators
```python
@require_auth()           # Requires user or admin access
@require_auth(admin=True) # Requires admin access only
```

### JavaScript Protection
```javascript
// Check authentication and redirect if needed
await AuthManager.requireAuth(storeId, adminRequired);
```

### Route Access Matrix

| Route | No Auth | Legacy Mode | User Access | Admin Access |
|-------|---------|-------------|-------------|--------------|
| `/login` | ✓ | ✓ | Redirect to store | Redirect to store |
| `/{store_id}/` | Redirect | ✓ | ✓ | ✓ |
| `/{store_id}/wizard` | Redirect | Redirect | ✓ | ✓ |
| `/{store_id}/prices` | Redirect | Redirect | ✓ (read-only) | ✓ (edit) |
| `/{store_id}/import` | Redirect | Redirect | Access denied | ✓ |
| `/{store_id}/settings` | Redirect | Redirect | Access denied | ✓ |
| `/{store_id}/floorplan` | Redirect | Redirect | Access denied | ✓ |

## API Authentication

API endpoints use Bearer token authentication. The frontend automatically includes tokens in requests:

```javascript
// Example authenticated API call
const response = await fetch(`/api/store/${storeId}/boxes`, {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});
```

### Response Codes
- **401 Unauthorized**: No valid token provided
- **403 Forbidden**: Valid token but insufficient permissions
- **200 OK**: Request successful

### Error Response Format
```json
{
    "detail": "Admin access required"
}

## Navigation System

The navigation adapts based on authentication level, showing only relevant options for each user type.

### Navigation Items by Access Level

**No Authentication**: No navigation shown (redirect to login)

**Legacy Mode**: Only basic navigation with store number

**User Access (Point-of-Sale)**:
- Wizard - Simplified box selection interface
- Packing - Traditional calculator
- View Prices - Read-only price list

**Admin Access (Back Office)**:
- All user items plus:
- Edit Prices - Modify box pricing
- Import - Excel bulk updates
- Floorplan - Visual box location mapping
- Settings - Configure packing rules and recommendation engine

### Visual Indicators
- Store number displayed in navigation
- "ADMIN" badge shown for administrators
- Dropdown menu on hover for authentication status

## PIN Management

PINs are designed to be simple for store associates while maintaining security through proper hashing and session management.

### PIN Characteristics
- 6 digits (000000-999999)
- Cryptographically random generation
- Stored as bcrypt hash
- No recovery mechanism (regeneration only)

### Admin Management
Administrators can manage PINs through:
1. **Command Line**: `./tools/auth regenerate-pin {store_id}`
2. **Settings Page**: Regenerate button in the Logins tab
3. **Initial Setup**: Generated when creating store authentication

### Best Practices
- Share PINs only with authorized staff
- Regenerate when employees leave
- Store securely (not in plain text files)
- Consider posting in secure areas only

## Email System

The application uses SMTP for sending verification codes to administrators. No third-party email services are required.

### Configuration

Set these environment variables for email:

```bash
# Development (using MailHog)
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_USE_TLS=false
SMTP_FROM=noreply@packingsite.com

# Production (example with Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USE_TLS=true
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com
```

### Development Testing

The docker-compose includes MailHog for email testing:
- SMTP server: `localhost:1025`
- Web interface: `http://localhost:8026`

All emails sent in development can be viewed in the MailHog web interface.

### Email Template

Verification emails use a clean, professional template:
- Subject: "Your Packing Site Login Code"
- Contains 6-character verification code
- 5-minute expiration notice
- HTML and plain text versions

## Security Features

The authentication system includes multiple layers of security:

### Password Security
- PINs are bcrypt hashed with salt
- Email verification codes are single-use
- Codes expire after 5 minutes
- Sessions expire after 24 hours

### Audit Trail
All authentication events are logged:
- Login attempts (success/failure)
- Email code generation
- Session creation
- Logout events

### Session Management
- Cryptographically secure token generation
- Tokens stored in browser localStorage
- Automatic cleanup of expired sessions
- Per-store isolation

### Rate Limiting Considerations
While not currently implemented, the audit log provides data for detecting abuse patterns.

## Frontend Integration

The authentication system includes a complete frontend library (`/lib/auth.js`) that provides:

### Core Functions
- `AuthManager.requireAuth(storeId, adminRequired)` - Protect pages
- `AuthManager.getAuthStatus(storeId)` - Check current auth state
- `AuthManager.logout(storeId)` - End session

### Token Management
- Automatic token inclusion in API requests
- Secure storage in localStorage
- Automatic redirect on 401 responses

### UI Components
- Navigation integration with role-based menus
- Login/logout buttons
- Admin badges and indicators

## Troubleshooting

### Common Issues

**Can't receive email codes**:
- Check SMTP configuration
- Verify admin email is correct
- Check spam folder
- Use MailHog web UI in development

**PIN not working**:
- Ensure correct store number
- Verify PIN hasn't been regenerated
- Check for typos (all digits)

**Session expired**:
- Sessions last 24 hours
- Login again to continue
- Check browser localStorage if issues persist

**Legacy mode limitations**:
- Only packing calculator accessible
- Create authentication to enable all features