"""
Rate limiting for authentication endpoints
"""
import os
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from backend.lib.rate_limit_dedup import should_count_attempt, get_attempt_count


# In-memory storage for email rate limiting (per store)
email_attempts: Dict[str, List[datetime]] = defaultdict(list)


def get_real_client_ip(request: Request) -> str:
    """
    Get the real client IP address, handling reverse proxy headers.
    Checks X-Forwarded-For and X-Real-IP headers first, falls back to direct connection.
    """
    # Check X-Forwarded-For header (may contain multiple IPs)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For can contain multiple IPs, the first is the original client
        return forwarded_for.split(",")[0].strip()
    
    # Check X-Real-IP header (single IP)
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    
    # Fall back to direct connection IP
    return get_remote_address(request)


def get_store_key(request: Request) -> str:
    """Get store ID from request path for rate limiting"""
    # Extract store_id from path like /api/store/{store_id}/...
    path_parts = request.url.path.split('/')
    if len(path_parts) >= 4 and path_parts[2] == 'store':
        return f"{get_real_client_ip(request)}:{path_parts[3]}"
    return get_real_client_ip(request)


# Create limiter with custom key function
limiter = Limiter(key_func=get_store_key)

# Absolute limits to prevent DoS even with deduplication
ABSOLUTE_LIMITS = {
    "/api/auth/login": 20,  # Max 20 attempts/minute regardless
    "/api/auth/verify-code": 30,
    "/api/admin/login": 20,
    "/api/admin/login/totp": 30,
}


def check_rate_limit_with_dedup(
    request: Request, 
    endpoint: str, 
    *credential_parts: str,
    per_minute_limit: int = 5
) -> None:
    """
    Check rate limit with deduplication support.
    
    Args:
        request: FastAPI request object
        endpoint: API endpoint being accessed
        credential_parts: Credential parts to hash for deduplication
        per_minute_limit: Standard rate limit per minute
    
    Raises:
        HTTPException: If rate limit is exceeded
    """
    ip = get_real_client_ip(request)
    
    # Check absolute limit to prevent DoS
    absolute_limit = ABSOLUTE_LIMITS.get(endpoint, per_minute_limit * 4)
    unique_attempts = get_attempt_count(ip, endpoint, minutes=1)
    
    if unique_attempts >= absolute_limit:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded"
        )
    
    # Check if this is a duplicate attempt
    if not should_count_attempt(ip, endpoint, *credential_parts):
        # Duplicate attempt, don't count against rate limit
        return


def check_email_rate_limit(store_id: str) -> None:
    """
    Check if email rate limit has been exceeded for a store.
    Raises HTTPException if limit exceeded.
    """
    now = datetime.now()
    hour_ago = now - timedelta(hours=1)
    
    # Get rate limit from environment
    email_limit = int(os.getenv("EMAIL_RATE_LIMIT_PER_HOUR", "10"))
    
    # Clean old attempts
    email_attempts[store_id] = [
        attempt for attempt in email_attempts[store_id]
        if attempt > hour_ago
    ]
    
    # Check if limit exceeded
    if len(email_attempts[store_id]) >= email_limit:
        raise HTTPException(
            status_code=429,
            detail="Too many email requests. Please try again later."
        )
    
    # Record this attempt
    email_attempts[store_id].append(now)


def reset_email_attempts(store_id: str) -> None:
    """Reset email attempts for a store (for testing)"""
    if store_id in email_attempts:
        del email_attempts[store_id]