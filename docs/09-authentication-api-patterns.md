# Authentication API Patterns

**MANDATORY**: All API endpoints MUST follow these patterns. Non-compliance will result in PR rejection.

## 🚀 Quick Start Templates

### Basic Authenticated Endpoint
```python
from fastapi import APIRouter, HTTPException, Path
from typing import Tuple
from backend.lib.auth_middleware import get_current_auth

@router.get("/api/store/{store_id}/data")
async def get_data(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    auth_info: Tuple[str, str] = get_current_auth()
):
    """Your endpoint description"""
    auth_store_id, auth_level = auth_info
    
    # Verify user has access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail=f"Not authorized to access store {store_id}")
    
    # Your logic here
    return {"data": "example"}
```

### Admin-Only Endpoint
```python
@router.post("/api/store/{store_id}/update")
async def update_data(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    data: YourModel = Body(...),
    auth_info: Tuple[str, str] = get_current_auth()
):
    """Admin only endpoint"""
    auth_store_id, auth_level = auth_info
    
    # Check admin access
    if auth_level != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail=f"Not authorized to access store {store_id}")
    
    # Your logic here
    return {"message": "Updated"}
```

### Demo-Aware Endpoint
```python
from backend.lib.auth_middleware import get_current_auth_with_demo

@router.post("/api/store/{store_id}/sensitive")
async def sensitive_operation(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    auth_info: dict = get_current_auth_with_demo()
):
    """Demo-restricted endpoint"""
    
    # Check if demo mode
    if auth_info.get('is_demo', False):
        raise HTTPException(status_code=403, detail="Not allowed in demo mode")
    
    # Standard checks
    if auth_info['auth_level'] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if auth_info['store_id'] != store_id:
        raise HTTPException(status_code=403, detail=f"Not authorized to access store {store_id}")
    
    # Your logic here
    return {"message": "Completed"}
```

## ✅ Checklist

Before submitting your PR, ensure:

- [ ] Using `auth_info` as parameter name
- [ ] Using `get_current_auth()` (note the parentheses!)
- [ ] Checking admin access if required
- [ ] Verifying store access with `auth_store_id != store_id`
- [ ] Using `Path(..., regex=r"^\d{1,6}$")`
- [ ] Providing clear error messages

## Available Auth Functions

### `get_current_auth()`
- **Returns**: `Tuple[str, str]` - (store_id, auth_level)
- **Use for**: Standard authenticated endpoints
- **Auth levels**: "user" or "admin"

### `get_current_auth_with_demo()`
- **Returns**: `dict` with keys: `store_id`, `auth_level`, `is_demo`
- **Use for**: Endpoints that need demo mode awareness

### `get_optional_auth_with_demo()`
- **Returns**: `Optional[dict]` - None if not authenticated
- **Use for**: Endpoints with optional authentication

## ❌ What NOT to Do

### 1. DO NOT use deprecated decorator
```python
# ❌ DEPRECATED - DO NOT USE
@require_auth(admin=True)
async def bad_example():
    pass
```

### 2. DO NOT skip store verification
```python
# ❌ BAD - Security vulnerability!
async def bad_endpoint(
    store_id: str,
    auth_info: Tuple[str, str] = get_current_auth()
):
    # Missing: if auth_info[0] != store_id
    return data  
```

### 3. DO NOT use inconsistent patterns
```python
# ❌ BAD - Wrong variable name, multiple auth
async def bad_endpoint(
    auth: Tuple[str, str] = get_current_auth(),
    auth_info: dict = get_current_auth_with_demo()
):
    pass
```

## Order of Checks

Always check in this order:
1. Admin access (if required)
2. Store access verification
3. Demo mode restrictions (if applicable)

## Migration Guide

If you find old code using `@require_auth`:

### Before (Deprecated):
```python
@router.post("/endpoint")
@require_auth(admin=True)
async def old_endpoint(
    store_id: str,
    data: RequestModel,
    current_store_id: str = None,
    auth_level: str = None
):
    # Old implementation
```

### After (Current):
```python
@router.post("/endpoint")
async def new_endpoint(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    data: RequestModel = Body(...),
    auth_info: Tuple[str, str] = get_current_auth()
):
    auth_store_id, auth_level = auth_info
    
    # Check admin access
    if auth_level != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify access to this store
    if auth_store_id != store_id:
        raise HTTPException(status_code=403, detail=f"Not authorized to access store {store_id}")
    
    # Implementation continues...
```

## Testing Authentication

```python
# Create test token
token = create_session("1", auth_level="admin")

# Test authorized request
response = client.get(
    "/api/store/1/boxes",
    headers={"Authorization": f"Bearer {token}"}
)

# Test unauthorized
response = client.get("/api/store/1/boxes")
assert response.status_code == 401

# Test wrong store
token = create_session("2", auth_level="admin")
response = client.get(
    "/api/store/1/boxes",  # Store 1 with store 2 token
    headers={"Authorization": f"Bearer {token}"}
)
assert response.status_code == 403
```

## Response Codes

- **401 Unauthorized**: No valid token
- **403 Forbidden**: Valid token, insufficient permissions
- **200 OK**: Success

## Error Response Format
```json
{
    "detail": "Admin access required"
}
```