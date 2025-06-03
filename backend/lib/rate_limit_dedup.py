"""
Rate limiting deduplication module

This module provides deduplication for rate limiting to prevent users from being
unfairly rate limited when repeatedly entering the same credentials (e.g., wrong
capitalization). Identical attempts within a 60-second window don't count against
the rate limit.

Security principles:
- Never store actual credentials - only hashes
- Time-limited memory (60 seconds)
- Still enforce absolute limits to prevent DoS
- No user feedback about deduplication
"""
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from backend.lib.auth_manager import get_db


def should_count_attempt(ip: str, endpoint: str, *credential_parts: str) -> bool:
    """
    Check if this attempt should count against rate limit.
    Returns True if it should count, False if it's a duplicate.
    
    Args:
        ip: Client IP address
        endpoint: API endpoint being accessed
        credential_parts: Parts to hash (e.g., username, password)
    
    Returns:
        True if this attempt should be counted, False if it's a duplicate
    """
    # Create hash of credentials
    credential_string = ":".join(str(part) for part in credential_parts)
    attempt_hash = hashlib.sha256(credential_string.encode()).hexdigest()
    
    with get_db() as db:
        # Clean old entries (older than 60 seconds)
        db.execute("""
            DELETE FROM rate_limit_attempts 
            WHERE timestamp < datetime('now', '-60 seconds')
        """)
        
        # Check for duplicate attempt in last 60 seconds
        duplicate = db.execute("""
            SELECT 1 FROM rate_limit_attempts 
            WHERE ip_address = ? 
            AND endpoint = ? 
            AND attempt_hash = ?
            AND timestamp > datetime('now', '-60 seconds')
            LIMIT 1
        """, (ip, endpoint, attempt_hash)).fetchone()
        
        if duplicate:
            # Don't count this attempt
            return False
        
        # Record this attempt
        db.execute("""
            INSERT INTO rate_limit_attempts (ip_address, endpoint, attempt_hash)
            VALUES (?, ?, ?)
        """, (ip, endpoint, attempt_hash))
        
        db.commit()
        return True


def cleanup_old_attempts(minutes: int = 5) -> int:
    """
    Clean up old rate limit attempts from the database.
    This can be called periodically to keep the table size manageable.
    
    Args:
        minutes: Delete attempts older than this many minutes (default: 5)
    
    Returns:
        Number of rows deleted
    """
    # Validate minutes parameter to prevent SQL injection
    if not isinstance(minutes, int) or minutes < 0 or minutes > 10080:  # Max 1 week
        raise ValueError("Invalid minutes parameter: must be integer between 0 and 10080")
    
    with get_db() as db:
        # Use parameterized query - SQLite doesn't support parameterized intervals,
        # but we've validated the input above
        cursor = db.execute(f"""
            DELETE FROM rate_limit_attempts 
            WHERE timestamp < datetime('now', '-{minutes} minutes')
        """)
        db.commit()
        return cursor.rowcount


def get_attempt_count(ip: str, endpoint: str, minutes: int = 1) -> int:
    """
    Get the number of unique attempts from an IP for an endpoint in the last N minutes.
    This counts unique attempt hashes, not total requests.
    
    Args:
        ip: Client IP address
        endpoint: API endpoint
        minutes: Time window in minutes (default: 1)
    
    Returns:
        Number of unique attempts
    """
    # Validate minutes parameter to prevent SQL injection
    if not isinstance(minutes, int) or minutes < 0 or minutes > 10080:  # Max 1 week
        raise ValueError("Invalid minutes parameter: must be integer between 0 and 10080")
    
    with get_db() as db:
        # Use parameterized query - SQLite doesn't support parameterized intervals,
        # but we've validated the input above
        result = db.execute(f"""
            SELECT COUNT(DISTINCT attempt_hash) as count
            FROM rate_limit_attempts 
            WHERE ip_address = ? 
            AND endpoint = ?
            AND timestamp > datetime('now', '-{minutes} minutes')
        """, (ip, endpoint)).fetchone()
        
        return result['count'] if result else 0