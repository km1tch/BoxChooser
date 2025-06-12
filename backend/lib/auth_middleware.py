"""
FastAPI authentication middleware and decorators

IMPORTANT: All new endpoints MUST use the standard dependency injection pattern.
See docs/authentication-api-patterns.md for the required authentication patterns.
"""

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Tuple
from backend.lib import auth_manager

# Bearer token security scheme
bearer_scheme = HTTPBearer(auto_error=False)

def _get_current_auth_impl(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> Tuple[str, str]:
    """
    Implementation that verifies Bearer token and returns (store_id, auth_level)
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    result = auth_manager.verify_session(token)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    store_id, auth_level = result
    
    # Check if store is disabled (unless it's a superadmin)
    if auth_level != 'superadmin':
        from backend.lib.auth_manager import get_db
        with get_db() as db:
            store = db.execute(
                "SELECT status FROM store_auth WHERE store_id = ?",
                (store_id,)
            ).fetchone()
            
            if store and store['status'] != 'active':
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Store is disabled"
                )
    
    return result

def get_current_auth():
    """
    Verify Bearer token and return (store_id, auth_level)
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    return _get_current_auth_impl

def get_current_auth_with_demo():
    """
    Verify Bearer token and return full session info including is_demo
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    def _get_current_auth_with_demo_impl(
        credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
    ) -> dict:
        token = credentials.credentials
        result = auth_manager.get_session_info(token)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return result
    
    return Depends(_get_current_auth_with_demo_impl)

def get_current_store(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> str:
    """
    Verify Bearer token and return the store_id
    (Backward compatibility - ignores auth level)
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    result = auth_manager.verify_session(token)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    store_id, _ = result
    return store_id



def get_optional_auth() -> Optional[Tuple[str, str]]:
    """
    Get the current (store_id, auth_level) if authenticated, None otherwise
    
    This is useful for endpoints that behave differently when authenticated
    """
    def _get_optional_auth(
        request: Request,
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
    ) -> Optional[Tuple[str, str]]:
        if not credentials:
            return None
        
        try:
            token = credentials.credentials
            return auth_manager.verify_session(token)
        except:
            return None
    
    return Depends(_get_optional_auth)

def get_optional_auth_with_demo() -> Optional[dict]:
    """
    Get full session info including is_demo flag if authenticated, None otherwise
    """
    def _get_optional_auth_with_demo(
        request: Request,
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
    ) -> Optional[dict]:
        if not credentials:
            return None
        
        try:
            token = credentials.credentials
            return auth_manager.get_session_info(token)
        except:
            return None
    
    return Depends(_get_optional_auth_with_demo)


def get_current_superadmin():
    """
    Verify Bearer token and ensure the user is a superadmin
    
    Returns:
        Tuple[str, str]: (store_id, auth_level) where auth_level is 'superadmin'
        
    Raises:
        HTTPException: If token is invalid, expired, or user is not a superadmin
    """
    def _get_current_superadmin_impl(
        auth_info: Tuple[str, str] = Depends(_get_current_auth_impl)
    ) -> Tuple[str, str]:
        store_id, auth_level = auth_info
        
        if auth_level != 'superadmin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Superadmin access required"
            )
        
        return auth_info
    
    return Depends(_get_current_superadmin_impl)


