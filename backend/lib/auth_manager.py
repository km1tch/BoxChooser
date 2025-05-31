"""
Authentication Management Library for Packing Website

This is the CORE authentication library that handles:
- Database schema and initialization
- PIN and email-based authentication
- Session management (tokens) with auth levels
- Audit logging

IMPORTANT: Do not use this module directly for admin tasks. Instead, use the 
CLI tool: tools/manage_auth.py

Examples:
    # Using the convenience script (runs inside Docker):
    ./tools/auth init
    ./tools/auth create 1

The database is stored at the location specified by SQLITE_DB_PATH environment
variable, or defaults to: /zpool/dev/PackingWebsite/db/packingwebsite.db
"""

import json
import os
import random
import secrets
import sqlite3
import string
import sys
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import bcrypt


# Database management
def get_db_path():
    """Get the database path from the environment variable or use the default."""
    default_path = str(Path(__file__).resolve().parent.parent / 'db' / 'packingwebsite.db')
    return os.environ.get('SQLITE_DB_PATH', default_path)

@contextmanager
def get_db():
    """Get a database connection with automatic cleanup"""
    db_path = get_db_path()
    
    # Ensure the directory exists
    db_dir = os.path.dirname(db_path)
    os.makedirs(db_dir, exist_ok=True)
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    """Initialize the database with required tables"""
    with get_db() as db:
        # Stores table - now with email and PIN
        db.execute('''
            CREATE TABLE IF NOT EXISTS store_auth (
                store_id TEXT PRIMARY KEY,
                admin_email TEXT NOT NULL,
                pin_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Email verification codes
        db.execute('''
            CREATE TABLE IF NOT EXISTS email_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_id TEXT NOT NULL,
                email TEXT NOT NULL,
                code TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (store_id) REFERENCES store_auth(store_id)
            )
        ''')
        
        # Sessions table - now with auth level
        db.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                store_id TEXT NOT NULL,
                auth_level TEXT NOT NULL CHECK (auth_level IN ('user', 'admin', 'superadmin')),
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (store_id) REFERENCES store_auth(store_id)
            )
        ''')
        
        # Audit log for tracking access
        db.execute('''
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_id TEXT NOT NULL,
                action TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                details TEXT
            )
        ''')
        
        # Store-specific packing rules
        db.execute('''
            CREATE TABLE IF NOT EXISTS store_packing_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_id VARCHAR(4) NOT NULL,
                packing_type VARCHAR(20) NOT NULL CHECK (packing_type IN ('Basic', 'Standard', 'Fragile', 'Custom')),
                padding_inches INTEGER NOT NULL DEFAULT 0,
                wizard_description TEXT NOT NULL,
                label_instructions TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                CONSTRAINT unique_store_packing_rule UNIQUE (store_id, packing_type)
            )
        ''')
        
        # Index for fast lookups
        db.execute('''
            CREATE INDEX IF NOT EXISTS idx_store_packing_lookup 
            ON store_packing_rules(store_id, packing_type)
        ''')
        
        # Store-specific recommendation engine config
        db.execute('''
            CREATE TABLE IF NOT EXISTS store_engine_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_id VARCHAR(4) NOT NULL UNIQUE,
                weight_price REAL NOT NULL DEFAULT 0.45,
                weight_efficiency REAL NOT NULL DEFAULT 0.25,
                weight_ease REAL NOT NULL DEFAULT 0.30,
                strategy_normal INTEGER NOT NULL DEFAULT 0,
                strategy_prescored INTEGER NOT NULL DEFAULT 1,
                strategy_flattened INTEGER NOT NULL DEFAULT 2,
                strategy_manual_cut INTEGER NOT NULL DEFAULT 5,
                strategy_telescoping INTEGER NOT NULL DEFAULT 6,
                strategy_cheating INTEGER NOT NULL DEFAULT 8,
                practically_tight_threshold REAL NOT NULL DEFAULT 5,
                max_recommendations INTEGER NOT NULL DEFAULT 10,
                extreme_cut_threshold REAL NOT NULL DEFAULT 0.5,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                CONSTRAINT weights_sum CHECK (
                    ABS(weight_price + weight_efficiency + weight_ease - 1.0) < 0.001
                ),
                CONSTRAINT strategy_range CHECK (
                    strategy_normal >= 0 AND strategy_normal <= 10 AND
                    strategy_prescored >= 0 AND strategy_prescored <= 10 AND
                    strategy_flattened >= 0 AND strategy_flattened <= 10 AND
                    strategy_manual_cut >= 0 AND strategy_manual_cut <= 10 AND
                    strategy_telescoping >= 0 AND strategy_telescoping <= 10 AND
                    strategy_cheating >= 0 AND strategy_cheating <= 10
                ),
                CONSTRAINT threshold_range CHECK (
                    extreme_cut_threshold > 0 AND extreme_cut_threshold <= 1
                )
            )
        ''')
        
        # Superadmin tables
        db.execute('''
            CREATE TABLE IF NOT EXISTS superadmins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        ''')
        
        db.execute('''
            CREATE INDEX IF NOT EXISTS idx_superadmins_username ON superadmins(username)
        ''')
        
        db.execute('''
            CREATE TABLE IF NOT EXISTS superadmin_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                superadmin_username TEXT NOT NULL,
                action TEXT NOT NULL,
                target_store_id TEXT,
                details JSON,
                success BOOLEAN DEFAULT TRUE
            )
        ''')
        
        db.execute('''
            CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON superadmin_audit(timestamp)
        ''')
        
        db.execute('''
            CREATE INDEX IF NOT EXISTS idx_audit_superadmin ON superadmin_audit(superadmin_username)
        ''')
        
        # Add columns to existing tables if they don't exist
        # Check if columns exist before adding (SQLite doesn't support IF NOT EXISTS for ALTER)
        cursor = db.execute("PRAGMA table_info(store_auth)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'status' not in columns:
            db.execute('ALTER TABLE store_auth ADD COLUMN status TEXT DEFAULT "active"')
        if 'disabled_reason' not in columns:
            db.execute('ALTER TABLE store_auth ADD COLUMN disabled_reason TEXT')
        if 'disabled_at' not in columns:
            db.execute('ALTER TABLE store_auth ADD COLUMN disabled_at TIMESTAMP')
        if 'disabled_by' not in columns:
            db.execute('ALTER TABLE store_auth ADD COLUMN disabled_by TEXT')
        
        # Check sessions table columns
        cursor = db.execute("PRAGMA table_info(sessions)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'auth_level' not in columns:
            db.execute('ALTER TABLE sessions ADD COLUMN auth_level TEXT DEFAULT "user"')
        if 'sudo_stores' not in columns:
            db.execute('ALTER TABLE sessions ADD COLUMN sudo_stores TEXT')
        
        # Check superadmins table columns for TOTP
        cursor = db.execute("PRAGMA table_info(superadmins)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'totp_enabled' not in columns:
            db.execute('ALTER TABLE superadmins ADD COLUMN totp_enabled BOOLEAN DEFAULT FALSE')
        if 'totp_secret' not in columns:
            db.execute('ALTER TABLE superadmins ADD COLUMN totp_secret TEXT')
        
        # Rate limit attempts table for deduplication
        db.execute('''
            CREATE TABLE IF NOT EXISTS rate_limit_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip_address TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                attempt_hash TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        db.execute('''
            CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup 
            ON rate_limit_attempts(ip_address, endpoint, timestamp)
        ''')
        
        # Auto-cleanup old entries
        db.execute('''
            CREATE INDEX IF NOT EXISTS idx_rate_limit_cleanup 
            ON rate_limit_attempts(timestamp)
        ''')
        
        # Create demo store auth if it doesn't exist
        existing_demo = db.execute(
            "SELECT store_id FROM store_auth WHERE store_id = ?",
            ("999999",)
        ).fetchone()
        
        if not existing_demo:
            # Create demo store with a fixed PIN for demo purposes
            demo_pin = "123456"
            demo_pin_hash = bcrypt.hashpw(demo_pin.encode('utf-8'), bcrypt.gensalt())
            
            db.execute(
                "INSERT INTO store_auth (store_id, admin_email, pin_hash) VALUES (?, ?, ?)",
                ("999999", "demo@example.com", demo_pin_hash)
            )
            
            # Log the creation
            db.execute(
                "INSERT INTO audit_log (store_id, action, details) VALUES (?, ?, ?)",
                ("999999", "DEMO_CREATED", "Demo store authentication created during DB initialization")
            )
            
            print("✓ Demo store (999999) created with PIN: 123456")
        
        db.commit()

def generate_pin(length: int = 6) -> str:
    """
    Generate a cryptographically secure PIN
    
    Args:
        length: Number of digits (default: 6)
    
    Returns:
        A numeric PIN string
    """
    # Use secrets for cryptographic randomness
    return ''.join(secrets.choice(string.digits) for _ in range(length))

def generate_email_code(length: int = 6) -> str:
    """
    Generate a 6-character verification code for email
    
    Args:
        length: Number of characters (default: 6)
    
    Returns:
        An alphanumeric code (uppercase)
    """
    # Use uppercase letters and digits for clarity
    chars = string.ascii_uppercase + string.digits
    # Avoid confusing characters
    chars = chars.replace('O', '').replace('0', '').replace('I', '').replace('1', '')
    return ''.join(secrets.choice(chars) for _ in range(length))

def create_store_auth(store_id: str, admin_email: str, pin: Optional[str] = None) -> str:
    """
    Create or update authentication for a store
    
    Args:
        store_id: The store identifier (e.g., "1", "2", etc.)
        admin_email: Email address for admin authentication
        pin: Optional PIN. If not provided, generates one
    
    Returns:
        The PIN (either provided or generated)
    """
    if pin is None:
        pin = generate_pin()
    
    # Hash the PIN
    pin_hash = bcrypt.hashpw(pin.encode('utf-8'), bcrypt.gensalt())
    
    with get_db() as db:
        # Check if store already has auth
        existing = db.execute(
            "SELECT * FROM store_auth WHERE store_id = ?", 
            (store_id,)
        ).fetchone()
        
        if existing:
            # Update existing
            db.execute(
                """UPDATE store_auth 
                   SET admin_email = ?, pin_hash = ?, updated_at = CURRENT_TIMESTAMP
                   WHERE store_id = ?""",
                (admin_email, pin_hash, store_id)
            )
            action = "auth_updated"
        else:
            # Create new
            db.execute(
                "INSERT INTO store_auth (store_id, admin_email, pin_hash) VALUES (?, ?, ?)",
                (store_id, admin_email, pin_hash)
            )
            action = "store_created"
        
        # Log the action
        db.execute(
            "INSERT INTO audit_log (store_id, action) VALUES (?, ?)",
            (store_id, action)
        )
        
        db.commit()
    
    return pin

def verify_pin(store_id: str, pin: str) -> bool:
    """
    Verify a PIN for a store
    
    Args:
        store_id: The store identifier
        pin: The PIN to verify
    
    Returns:
        True if PIN is correct, False otherwise
    """
    with get_db() as db:
        result = db.execute(
            "SELECT pin_hash FROM store_auth WHERE store_id = ?",
            (store_id,)
        ).fetchone()
        
        if not result:
            return False
        
        is_valid = bcrypt.checkpw(
            pin.encode('utf-8'), 
            result['pin_hash']
        )
        
        # Log the attempt
        db.execute(
            "INSERT INTO audit_log (store_id, action, details) VALUES (?, ?, ?)",
            (store_id, "pin_login_attempt", json.dumps({"success": is_valid}))
        )
        db.commit()
        
        return is_valid

def create_email_verification_code(store_id: str, email: str) -> str:
    """
    Create an email verification code
    
    Args:
        store_id: The store identifier
        email: Email address to send code to
    
    Returns:
        The verification code
    """
    code = generate_email_code()
    expires_at = datetime.now() + timedelta(minutes=5)
    
    with get_db() as db:
        # Verify this is the correct admin email
        result = db.execute(
            "SELECT admin_email FROM store_auth WHERE store_id = ?",
            (store_id,)
        ).fetchone()
        
        if not result or result['admin_email'].lower() != email.lower():
            raise ValueError("Invalid email for this store")
        
        # Invalidate any existing codes
        db.execute(
            "UPDATE email_codes SET used = TRUE WHERE store_id = ? AND email = ? AND used = FALSE",
            (store_id, email)
        )
        
        # Create new code
        db.execute(
            "INSERT INTO email_codes (store_id, email, code, expires_at) VALUES (?, ?, ?, ?)",
            (store_id, email, code, expires_at)
        )
        
        # Log the action
        db.execute(
            "INSERT INTO audit_log (store_id, action, details) VALUES (?, ?, ?)",
            (store_id, "email_code_sent", json.dumps({"email": email}))
        )
        
        db.commit()
    
    return code

def verify_email_code(store_id: str, email: str, code: str) -> bool:
    """
    Verify an email code
    
    Args:
        store_id: The store identifier
        email: Email address
        code: The code to verify
    
    Returns:
        True if code is valid, False otherwise
    """
    with get_db() as db:
        result = db.execute(
            """SELECT id FROM email_codes 
               WHERE store_id = ? AND email = ? AND code = ? 
               AND expires_at > CURRENT_TIMESTAMP AND used = FALSE""",
            (store_id, email, code)
        ).fetchone()
        
        if result:
            # Mark as used
            db.execute(
                "UPDATE email_codes SET used = TRUE WHERE id = ?",
                (result['id'],)
            )
            
            # Log success
            db.execute(
                "INSERT INTO audit_log (store_id, action, details) VALUES (?, ?, ?)",
                (store_id, "email_login_success", json.dumps({"email": email}))
            )
            
            db.commit()
            return True
        else:
            # Log failure
            db.execute(
                "INSERT INTO audit_log (store_id, action, details) VALUES (?, ?, ?)",
                (store_id, "email_login_failed", json.dumps({"email": email}))
            )
            db.commit()
            return False

def create_session(store_id: str, auth_level: str = "user", hours: Optional[int] = None) -> str:
    """
    Create a new session token for a store
    
    Args:
        store_id: The store identifier
        auth_level: Either "user" or "admin"
        hours: How many hours the session should last (defaults to env vars)
    
    Returns:
        The session token
    """
    if auth_level not in ["user", "admin", "superadmin"]:
        raise ValueError("auth_level must be 'user', 'admin', or 'superadmin'")
    
    # Use environment variables for session duration
    if hours is None:
        if auth_level == "user":
            hours = int(os.getenv("USER_SESSION_HOURS", "168"))  # 7 days default
        elif auth_level == "superadmin":
            hours = int(os.getenv("SUPERADMIN_SESSION_HOURS", "1"))  # 1 hour default
        else:  # admin
            hours = int(os.getenv("ADMIN_SESSION_HOURS", "24"))   # 24 hours default
        
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now() + timedelta(hours=hours)
    
    with get_db() as db:
        # Clean up old sessions first
        db.execute(
            "DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP"
        )
        
        # Create new session
        db.execute(
            "INSERT INTO sessions (token, store_id, auth_level, expires_at) VALUES (?, ?, ?, ?)",
            (token, store_id, auth_level, expires_at)
        )
        
        # Log the session creation
        db.execute(
            "INSERT INTO audit_log (store_id, action, details) VALUES (?, ?, ?)",
            (store_id, "session_created", json.dumps({"auth_level": auth_level}))
        )
        
        db.commit()
    
    return token

def verify_session(token: str) -> Optional[Tuple[str, str]]:
    """
    Verify a session token and return the store_id and auth_level if valid
    
    Args:
        token: The session token to verify
    
    Returns:
        Tuple of (store_id, auth_level) if valid, None otherwise
    """
    with get_db() as db:
        result = db.execute(
            """SELECT store_id, auth_level FROM sessions 
               WHERE token = ? AND expires_at > CURRENT_TIMESTAMP""",
            (token,)
        ).fetchone()
        
        if result:
            return (result['store_id'], result['auth_level'])
        
        return None

def get_session_info(token: str) -> Optional[dict]:
    """
    Get full session information including is_demo flag
    
    Args:
        token: The session token
    
    Returns:
        Dict with session info if valid, None otherwise
    """
    with get_db() as db:
        result = db.execute(
            """SELECT store_id, auth_level FROM sessions 
               WHERE token = ? AND expires_at > CURRENT_TIMESTAMP""",
            (token,)
        ).fetchone()
        
        if result:
            return {
                'store_id': result['store_id'],
                'auth_level': result['auth_level'],
                'is_demo': result['store_id'] == '999999'  # Demo store ID
            }
        
        return None

def delete_session(token: str):
    """Delete a session (logout)"""
    with get_db() as db:
        # Get store_id for logging
        result = db.execute(
            "SELECT store_id FROM sessions WHERE token = ?",
            (token,)
        ).fetchone()
        
        if result:
            store_id = result['store_id']
            
            # Delete the session
            db.execute("DELETE FROM sessions WHERE token = ?", (token,))
            
            # Log the logout
            db.execute(
                "INSERT INTO audit_log (store_id, action) VALUES (?, ?)",
                (store_id, "logout")
            )
            
            db.commit()

def list_stores() -> List[Dict]:
    """List all stores with auth configured"""
    with get_db() as db:
        results = db.execute(
            """SELECT store_id, created_at, updated_at 
               FROM store_auth 
               ORDER BY store_id"""
        ).fetchall()
        
        return [dict(row) for row in results]

def hasAuth(store_id: str) -> bool:
    """Check if a store has authentication configured"""
    with get_db() as db:
        result = db.execute(
            "SELECT 1 FROM store_auth WHERE store_id = ?",
            (store_id,)
        ).fetchone()
        
        return result is not None

def get_audit_log(store_id: Optional[str] = None, limit: int = 100) -> List[Dict]:
    """
    Get audit log entries
    
    Args:
        store_id: Optional filter by store
        limit: Maximum number of entries to return
    
    Returns:
        List of audit log entries
    """
    with get_db() as db:
        if store_id:
            query = """SELECT * FROM audit_log 
                      WHERE store_id = ? 
                      ORDER BY timestamp DESC 
                      LIMIT ?"""
            results = db.execute(query, (store_id, limit)).fetchall()
        else:
            query = """SELECT * FROM audit_log 
                      ORDER BY timestamp DESC 
                      LIMIT ?"""
            results = db.execute(query, (limit,)).fetchall()
        
        return [dict(row) for row in results]

def get_store_info(store_id: str) -> Optional[Dict]:
    """Get store authentication info"""
    with get_db() as db:
        result = db.execute(
            "SELECT admin_email, created_at, updated_at FROM store_auth WHERE store_id = ?",
            (store_id,)
        ).fetchone()
        
        if result:
            return dict(result)
        return None

def regenerate_pin(store_id: str) -> str:
    """Regenerate PIN for a store"""
    new_pin = generate_pin()
    pin_hash = bcrypt.hashpw(new_pin.encode('utf-8'), bcrypt.gensalt())
    
    with get_db() as db:
        db.execute(
            "UPDATE store_auth SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE store_id = ?",
            (pin_hash, store_id)
        )
        
        # Log the action
        db.execute(
            "INSERT INTO audit_log (store_id, action) VALUES (?, ?)",
            (store_id, "pin_regenerated")
        )
        
        db.commit()
    
    return new_pin

def update_email(store_id: str, new_email: str) -> None:
    """
    Update the admin email for a store
    
    Args:
        store_id: The store identifier
        new_email: The new admin email address
    """
    with get_db() as db:
        # Check if store exists
        existing = db.execute(
            "SELECT admin_email FROM store_auth WHERE store_id = ?",
            (store_id,)
        ).fetchone()
        
        if not existing:
            raise ValueError(f"Store {store_id} does not have authentication configured")
        
        old_email = existing['admin_email']
        
        # Update the email
        db.execute(
            "UPDATE store_auth SET admin_email = ?, updated_at = CURRENT_TIMESTAMP WHERE store_id = ?",
            (new_email, store_id)
        )
        
        # Log the action
        db.execute(
            "INSERT INTO audit_log (store_id, action, details) VALUES (?, ?, ?)",
            (store_id, "email_updated", json.dumps({"old_email": old_email, "new_email": new_email}))
        )
        
        db.commit()


# This module is a library and should not be executed directly.
# Use tools/manage_auth.py instead for CLI operations.