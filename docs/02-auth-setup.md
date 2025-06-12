# Authentication Setup Guide

## Overview

The Packing Website uses a two-tier authentication system:

- **User Access (PIN)**: 6-digit PIN for store associates with read-only access
- **Admin Access (Email)**: Email-based verification for managers with full access

Each store has its own authentication configuration with both a PIN for users and email verification for administrators.

## Initial Setup

### Create Authentication for New Stores

**Prerequisites**: The store YAML file (e.g., `stores/store1.yml`) must exist before creating authentication.

```bash
# Create authentication with email and auto-generated PIN
./tools/auth create 1 admin@example.com
```

**What happens:**

1. Checks if `stores/store1.yml` exists (fails if not)
2. Checks if store already has auth (prompts for confirmation if yes)
3. Generates a 6-digit PIN for user access
4. Sets the admin email for manager access
5. **Outputs the PIN to stdout** for you to save
6. Stores hashed PIN and admin email in database

**Example Output:**

```
Authentication configured for Store 1
Admin Email: admin@example.com
User PIN: 384729

IMPORTANT: Save this PIN! It cannot be recovered.
Share this PIN with store associates who need read-only access.
```

**IMPORTANT**: Save the PIN immediately! It cannot be recovered.

## Superadmin Operations

**Quick Reference:**

- **(a) Create New Store**: `./tools/auth create {store_id} {admin_email}` (requires stores/store{id}.yml)
- **(b) Regenerate PIN**: `./tools/auth regenerate-pin {store_id}`
- **(c) Update Admin Email**: Via settings page after admin login

**Notes:**

- All commands output PINs to stdout
- Store YAML files must exist before creating auth
- Existing stores prompt for confirmation

### Create or Update Store Authentication

```bash
# Create new store auth
./tools/auth create 1 admin@example.com

# Update existing store (will prompt for confirmation)
./tools/auth create 1 newemail@example.com
```

### Regenerate PIN

When a PIN needs to be changed (employee turnover, security, etc.):

```bash
# Regenerate PIN for a store
./tools/auth regenerate-pin 1

# Force regeneration without confirmation
./tools/auth regenerate-pin 1 --force
```

This generates a new 6-digit PIN and invalidates the old one.

## Managing Authentication

### List All Stores with Auth

```bash
./tools/auth list
```

Shows all stores with authentication configured, including their admin emails.

### Verify a PIN

```bash
./tools/auth verify 1
```

Shows store info and prompts for the PIN to verify it's correct.

### View Audit Log

```bash
# All stores
./tools/auth audit

# Specific store
./tools/auth audit --store 1

# Last 100 entries
./tools/auth audit --limit 100
```

## How It Works

1. **PIN Generation**: System generates cryptographically secure 6-digit PINs using `secrets` module
2. **Storage**: PINs are bcrypt-hashed in SQLite database along with admin email addresses
3. **Sessions**: 24-hour sessions created after successful login
4. **Auth Levels**:
   - User (PIN): Read-only access to wizard, packing calculator, and price viewer
   - Admin (Email): Full access to all features including price editing and settings
5. **Audit Trail**: All login attempts and actions are logged

## Login Process

### For Store Associates (User Access)

1. Navigate to `/login` or `/{store_id}/login`
2. Select "Store Associate" mode
3. Enter store number and 6-digit PIN
4. Get redirected to wizard with read-only access

### For Managers (Admin Access)

1. Navigate to `/login` or `/{store_id}/login`
2. Select "Manager Access" mode
3. Enter store number and admin email
4. Receive 6-character verification code via email
5. Enter code (expires in 5 minutes)
6. Get redirected with full admin access

## Security Notes

- PINs are bcrypt-hashed, never stored in plain text
- Each store has its own PIN and admin email
- Sessions expire after 24 hours
- All access attempts are logged
- No PIN recovery - only regeneration
- 6-digit PINs provide 1 million combinations
- Email verification codes expire after 5 minutes
- Single-use email codes prevent replay attacks

## Frontend Integration

### Core Authentication Library for client: `/lib/auth.js`

Include this library in any page that needs authentication. It provides:

- **Token management**: get/set/remove authentication tokens
- **API methods**: login, verify, check auth status
- **Authenticated requests**: helper for making authorized API calls
- **Page protection**: automatic redirects for unauthorized access

### Usage Examples

For any page that needs authentication:

```html
<!-- Include the auth library -->
<script src="/lib/auth.js"></script>

<script>
  const storeId = '1'; // Get from URL path

  // Option 1: Require authentication (redirects to login if not authenticated)
  AuthManager.requireAuth(storeId);

  // Option 2: Check auth status without redirect
  const status = await AuthManager.getAuthStatus(storeId);
  if (status.isAuthenticated) {
    // Show protected content
  }

  // Option 3: Make authenticated API calls
  const response = await AuthManager.makeAuthenticatedRequest(
    `/api/store/${storeId}/prices`,
    { method: 'GET' },
    storeId
  );
</script>
```

### Auth UI Components

The library also provides UI helper functions:

```javascript
// Add login/logout UI to any container
AuthManager.initAuthUI("auth-container", storeId);

// Manual logout
AuthManager.logout(storeId);
```

### Navigation Integration

The navigation component (`/components/navigation.js`) automatically integrates with AuthManager to show:

- Nothing if no auth configured
- "Sign In" button if auth required but not logged in
- Auth badge with crown (👑) for admin or unlock (🔓) for user access
- Different navigation items based on auth level:
  - User: Wizard, Packing Calculator, View Prices
  - Admin: All user items plus Edit Prices, Import, Floorplan, Settings

```html
<div id="nav-container"></div>
<script src="/lib/auth.js"></script>
<script src="/components/navigation.js"></script>
<script>
  initAdminNav("nav-container", storeId, "prices");
</script>
```

## Email Configuration

The system uses SMTP for sending verification codes to administrators.

### Development (MailHog)

The docker-compose includes MailHog for local email testing:

- SMTP: `localhost:1025`
- Web UI: `http://localhost:8026`

### Production SMTP

Set these environment variables for production:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USE_TLS=true
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com
```

## Troubleshooting

### Lost PIN

There's no recovery mechanism. You must regenerate the PIN:

```bash
./tools/auth regenerate-pin {store_id}
```

### Email Not Sending

1. Check MailHog web UI at `http://localhost:8026` in development
2. Verify SMTP settings in environment variables
3. Check container logs: `docker compose logs site`

### Database Issues

If the database is corrupted, restart the Docker container to reinitialize:

```bash
docker compose restart
```

### Frontend Auth Issues

- **Token persists after logout**: Clear localStorage manually in browser console
- **Redirect loops**: Check if the API endpoints are returning correct status codes
- **Can't see auth UI**: Ensure `/lib/auth.js` is loaded before components

