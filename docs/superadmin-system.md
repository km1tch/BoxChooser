# Superadmin System

The superadmin system is **completely separate** from store authentication. It provides system-wide management capabilities.

## Key Differences

| Feature | Store Auth | Superadmin Auth |
|---------|------------|-----------------|
| Login Page | `/login` | `/admin-login.html` |
| Auth Levels | `user`, `admin` | `superadmin` |
| API Prefix | `/api/store/*` | `/api/admin/*` |
| Token Storage | `token` | `superadmin_token` |
| Database Tables | `store_auth` | `superadmins` |

**IMPORTANT**: Never mix these authentication systems!

## Database Tables

### superadmins
```sql
username        TEXT PRIMARY KEY
password_hash   TEXT NOT NULL
totp_secret     TEXT            -- Optional 2FA
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### superadmin_audit
```sql
id          INTEGER PRIMARY KEY
username    TEXT NOT NULL
action      TEXT NOT NULL
details     TEXT              -- JSON data
timestamp   TIMESTAMP
```

## Authentication Flow

1. Login at `/admin-login.html` with username/password
2. POST to `/api/admin/login`
3. Optional TOTP verification at `/api/admin/login/totp`
4. Receive bearer token with `auth_level='superadmin'`
5. Token valid for 24 hours

## Backend Implementation

### Creating Endpoints

```python
from fastapi import APIRouter, Depends
from backend.routers.superadmin import require_superadmin, audit_superadmin_action

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.post("/vendors")
async def create_vendor(
    vendor_data: dict,
    current_admin: dict = Depends(require_superadmin)
):
    # Username stored in store_id field (historical reasons)
    username = current_admin['store_id']
    
    # Do the operation
    result = create_vendor_in_db(vendor_data)
    
    # Audit log
    audit_superadmin_action(
        username, 
        "create_vendor",
        details={"vendor_name": vendor_data['name']}
    )
    
    return result
```

### The `require_superadmin` Dependency

- Extracts Bearer token from Authorization header
- Verifies session exists with `auth_level='superadmin'`
- Returns 403 if not superadmin
- Never accepts store auth tokens

## Frontend Implementation

### Page Authentication

```javascript
// Check auth on page load
async function init() {
    try {
        const dashboard = await SuperadminAPI.getDashboard();
        // User is authenticated
        loadPageContent();
    } catch (error) {
        // Not authenticated or token expired
        window.location.href = '/admin-login.html';
    }
}
```

### Making API Calls

```javascript
// All superadmin API calls use the SuperadminAPI class
const stores = await SuperadminAPI.getStores();
const vendors = await SuperadminAPI.getVendors();

// The class handles authentication automatically
// Token stored as 'superadmin_token' in localStorage
```

## Important Rules

1. **Always use `/api/admin/` prefix** for superadmin endpoints
2. **Never accept store tokens** in superadmin endpoints
3. **Always audit important actions** using `audit_superadmin_action()`
4. **Frontend must use SuperadminAPI class** for consistency
5. **Username is in `store_id` field** due to historical reasons

## Common Mistakes to Avoid

❌ **Wrong**: Mixing auth systems
```python
# BAD - Using store auth for superadmin endpoint
from backend.lib.auth_middleware import get_current_auth

@router.get("/api/admin/users")
async def bad_example(auth_info = get_current_auth()):
    pass
```

✅ **Correct**: Using superadmin auth
```python
# GOOD - Using superadmin dependency
from backend.routers.superadmin import require_superadmin

@router.get("/api/admin/users")
async def good_example(current_admin = Depends(require_superadmin)):
    pass
```

❌ **Wrong**: Using store API prefix
```python
# BAD - Wrong prefix
@router.get("/api/store/999999/admin-stuff")
```

✅ **Correct**: Using admin prefix
```python
# GOOD - Correct prefix
@router.get("/api/admin/stuff")
```