# Demo Mode

## Overview

Demo mode provides a zero-friction way for potential users to explore the packing tools without creating an account. It uses a dedicated demo store (ID: 999999) that automatically resets to prevent data persistence.

## User Guide

### Accessing Demo Mode

1. Navigate to the login page
2. Click the "Demo" tab (third tab after "Point-of-Sale" and "Back Office Admin")
3. Choose one of three options:
   - **Login as Demo User**: Explore the wizard and view prices (read-only access)
   - **Login as Demo Admin**: Full access to edit prices and settings
   - **Reset Demo Environment**: Restore demo data to original state

### Demo Mode Features

**Available Features:**

- ✅ Packing wizard for box recommendations
- ✅ Price viewing and editing (admin)
- ✅ Excel import/export (admin)
- ✅ Packing rules configuration (admin)
- ✅ Recommendation engine tuning (admin)
- ✅ Floorplan viewing with box locations
- ✅ Vendor catalog browsing and import (admin)
- ✅ Itemized pricing with materials and services breakdown
- ✅ Box management - add/edit custom boxes (admin)

**Restricted Features:**

- ❌ Floorplan upload (security restriction)
- ❌ Login management tab in settings
- ❌ Email notifications

### Visual Indicators

Demo sessions display special badges in the navigation:

- **DEMO** - Teal badge for demo user sessions
- **DEMO ADMIN** - Teal badge for demo admin sessions

### Auto-Reset Behavior

The demo environment automatically resets when a user logs in if any of these conditions are met:

- The store999999.yml file is missing
- The demo_last_reset timestamp is not set in the YAML file
- More than 1 hour has passed since the last reset

This ensures:

- Clean state for new users
- No persistent vandalism
- Consistent demo experience
- Automatic recovery from file corruption or deletion

## Developer Guide

### Architecture

Demo mode is implemented as a special store (999999) that follows standard store patterns with minimal special handling.

### Key Components

#### 1. Data Files

```
stores/
├── demo_store.yml    # Clean template (never modified)
├── store999999.yml   # Active demo store (reset from template)

floorplans/
├── demo_floor.png    # Static demo floorplan
```

#### 2. Authentication

- Demo store auth created automatically during DB initialization
- Fixed PIN: 123456 (for internal use only)
- Sessions include `is_demo: true` flag

#### 3. Backend Endpoints

```python
# Demo-specific endpoints in /backend/routers/auth.py
POST /api/auth/demo/login     # Login with {auth_level: "user"|"admin"}
POST /api/auth/demo/reset     # Reset demo environment (clears DB customizations)
```

#### 4. Session Handling

```python
# Creating demo sessions includes is_demo flag
token = create_session("999999", auth_level=auth_level, is_demo=True)

# Checking demo status
auth_info = get_session_info(token)
if auth_info.get('is_demo', False):
    # Handle demo-specific logic
```

### Implementation Patterns

#### Checking for Demo Mode

**Backend (Python)**:

```python
# In route handlers
auth_info: dict = Depends(get_current_auth_with_demo)
if auth_info.get('is_demo', False):
    raise HTTPException(403, "Not allowed in demo mode")
```

**Frontend (JavaScript)**:

```javascript
// Get auth status including demo flag
const authStatus = await AuthManager.getAuthStatus(storeId);
if (authStatus.isDemo) {
  // Hide or disable features
}
```

#### File Handling

Demo store uses the standard naming convention:

```python
# Demo store uses stores/store999999.yml like any other store
yaml_file = f"stores/store{store_id}.yml"
```

### Adding New Features

When implementing new features, consider demo mode:

1. **Data Persistence**: Will it modify store999999.yml or database? Database changes are cleared on reset.

2. **Security Sensitive**: Does it allow file uploads or external communication? Consider restricting:

   ```python
   if auth_info.get('is_demo', False):
       raise HTTPException(403, "Feature not available in demo mode")
   ```

3. **UI Elements**: Should it be hidden/disabled in demo mode?

   ```javascript
   if (authStatus.isDemo) {
     element.style.display = "none";
   }
   ```

4. **Store ID Validation**: Update regex patterns to allow 6 digits:
   ```python
   store_id: str = Path(..., regex=r"^\d{1,6}$")  # Allows demo store 999999
   ```

### Reset Mechanism

The reset process:

1. Clears database customizations for store 999999:
   - Custom packing rules (`store_packing_rules` table)
   - Custom engine configuration (`store_engine_config` table)
2. Copies `demo_store.yml` → `store999999.yml` (full reset)
3. Adds `demo_last_reset` timestamp to track when reset occurred

Reset triggers:

- **Automatic**: On demo login if file is missing, timestamp is unset, or >1 hour since last reset
- **Manual**: "Reset Demo Environment" button on login page

### Best Practices

1. **Treat Demo as a Regular Store**: Minimize special handling. Demo store should work like any other store except for explicit restrictions.

2. **Use Existing Patterns**: Demo auth uses standard sessions, just with an extra flag.

3. **Fail Gracefully**: If demo.yml is missing, endpoints should return appropriate errors.

4. **Security First**: When in doubt, restrict features in demo mode rather than risk exposure.

### Testing Demo Mode

1. **Reset Functionality**:

   ```bash
   # Should clear DB customizations and update timestamp
   curl -X POST http://localhost:5893/api/auth/demo/reset
   ```

2. **Login Flow**:

   ```bash
   # Login as demo admin
   curl -X POST http://localhost:5893/api/auth/demo/login \
     -H "Content-Type: application/json" \
     -d '{"auth_level": "admin"}'
   ```

3. **Feature Restrictions**:
   - Try uploading a floorplan (should fail)
   - Check settings page (logins tab should be hidden)

### Monitoring

Look for these in logs:

- "Demo store (999999) created" - DB initialization
- "Demo environment reset successfully" - Manual resets
- "Floorplan upload is not allowed in demo mode" - Restriction enforcement

### Disabling Demo Mode

To completely disable demo mode:

1. Remove store 999999 from the auth database
2. Delete stores/store999999.yml
3. Demo tab will still appear but logins will fail

### Common Issues

**Demo login fails**: Check if store999999.yml exists and DB has been initialized

**Changes persist too long**: The automatic reset occurs on login, not continuously. If users stay logged in, changes persist until next login after 1 hour

**Feature works in demo**: Add demo check to the endpoint/UI component

**Regular stores affected**: Ensure demo checks specifically test for store 999999 or is_demo flag
