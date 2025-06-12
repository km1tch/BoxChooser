#!/usr/bin/env python3
"""
Store Authentication Management Tool

This tool manages store authentication for the Packing Website.
It supports creating stores with email/PIN authentication.

Examples:
    # Using the convenience script (runs inside Docker):
    ./tools/auth create 1 admin@example.com
    ./tools/auth list
    ./tools/auth regenerate-pin 1
    ./tools/auth modify-email 1 newemail@example.com
    ./tools/auth verify 1
    ./tools/auth audit
    
Note: This tool should be run inside the Docker container. The convenience script
./tools/auth handles this automatically.
"""

import sys
import os
import argparse
import getpass
from tabulate import tabulate
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.lib.auth_manager import (
    init_db, create_store_auth, list_stores, 
    get_audit_log, verify_pin, hasAuth,
    get_store_info, regenerate_pin, update_email,
    get_db
)
import bcrypt
import secrets

def cmd_init(args):
    """Initialize the database"""
    init_db()
    print("Database initialized successfully.")

def cmd_create(args):
    """Create store authentication"""
    store_id = args.store
    admin_email = args.email
    
    # Check if store YAML file exists
    yaml_path = Path(f"stores/store{store_id}.yml")
    if not yaml_path.exists():
        print(f"Store configuration file 'stores/store{store_id}.yml' not found.")
        print(f"Creating minimal store configuration...")
        
        # Create a minimal valid YAML file
        minimal_yaml = """# Store {store_id} Configuration
# Auto-generated minimal configuration
# Please edit this file to add your box inventory

start-screen: true  # Show getting started guide on first login

boxes: []  # Add your box definitions here

# Example box with itemized pricing:
# boxes:
#   - type: NormalBox
#     supplier: ULINE
#     model: "S-4344"
#     dimensions: [12, 9, 6]  # Length, Width, Height
#     itemized-prices:
#       box-price: 1.50
#       basic-materials: 0.25
#       basic-services: 0.75
#       standard-materials: 0.50
#       standard-services: 1.50
#       fragile-materials: 1.00
#       fragile-services: 3.00
#       custom-materials: 1.50
#       custom-services: 4.50
""".format(store_id=store_id)
        
        try:
            # Ensure stores directory exists
            yaml_path.parent.mkdir(exist_ok=True)
            
            # Write the minimal YAML file
            with open(yaml_path, 'w') as f:
                f.write(minimal_yaml)
            print(f"Created minimal store configuration at: {yaml_path}")
            print("Please edit this file later to add your box inventory.")
        except Exception as e:
            print(f"Error creating store configuration: {e}")
            return
    
    # Check if this store already has authentication
    if hasAuth(store_id):
        response = input(f"Store {store_id} already has authentication. Update it? [y/N]: ")
        if response.lower() != 'y':
            print("Aborted.")
            return
    
    # Create/update auth
    pin = create_store_auth(store_id, admin_email, None)  # Always generate PIN
    
    print(f"\nAuthentication configured for Store {store_id}")
    print(f"Admin Email: {admin_email}")
    print(f"User PIN: {pin}")
    print("\nIMPORTANT: Save this PIN! It cannot be recovered.")
    print("Share this PIN with store associates who need read-only access.")

def cmd_regenerate_pin(args):
    """Regenerate PIN for a store"""
    store_id = args.store
    
    if not hasAuth(store_id):
        print(f"Error: Store {store_id} does not have authentication configured.")
        return
    
    if not args.force:
        response = input(f"Regenerate PIN for Store {store_id}? This will invalidate the current PIN. [y/N]: ")
        if response.lower() != 'y':
            print("Aborted.")
            return
    
    new_pin = regenerate_pin(store_id)
    print(f"\nNew PIN for Store {store_id}: {new_pin}")
    print("\nIMPORTANT: Save this PIN! The old PIN no longer works.")

def cmd_modify_email(args):
    """Modify admin email for a store"""
    store_id = args.store
    new_email = args.email
    
    if not hasAuth(store_id):
        print(f"Error: Store {store_id} does not have authentication configured.")
        return
    
    # Get current info
    info = get_store_info(store_id)
    current_email = info['admin_email']
    
    if not args.force:
        print(f"Current admin email for Store {store_id}: {current_email}")
        response = input(f"Change admin email to {new_email}? [y/N]: ")
        if response.lower() != 'y':
            print("Aborted.")
            return
    
    try:
        update_email(store_id, new_email)
        print(f"\nAdmin email for Store {store_id} updated successfully.")
        print(f"Old email: {current_email}")
        print(f"New email: {new_email}")
    except Exception as e:
        print(f"Error updating email: {e}")
        sys.exit(1)

def cmd_list(args):
    """List all stores with authentication"""
    stores = list_stores()
    
    if not stores:
        print("No stores have authentication configured.")
        return
    
    # Format the data for tabulate
    table_data = []
    for store in stores:
        info = get_store_info(store['store_id'])
        table_data.append([
            store['store_id'],
            info['admin_email'] if info else 'N/A',
            store['created_at'],
            store['updated_at']
        ])
    
    headers = ['Store ID', 'Admin Email', 'Created', 'Last Updated']
    print(tabulate(table_data, headers=headers, tablefmt='plain'))

def cmd_verify(args):
    """Verify a store PIN"""
    store_id = args.store
    
    if not hasAuth(store_id):
        print(f"Store {store_id} does not have authentication configured.")
        return
    
    # Get store info
    info = get_store_info(store_id)
    print(f"\nStore {store_id} Authentication:")
    print(f"Admin Email: {info['admin_email']}")
    print(f"Created: {info['created_at']}")
    print(f"Updated: {info['updated_at']}")
    
    # Prompt for PIN
    pin = getpass.getpass("\nEnter PIN to verify: ")
    
    if verify_pin(store_id, pin):
        print("✓ PIN is correct")
    else:
        print("✗ Invalid PIN")
        sys.exit(1)

def cmd_audit(args):
    """Show audit log"""
    logs = get_audit_log(store_id=args.store, limit=args.limit)
    
    if not logs:
        print("No audit log entries found.")
        return
    
    # Format the data for tabulate
    table_data = []
    for log in logs:
        table_data.append([
            log['timestamp'],
            log['store_id'],
            log['action'],
            log.get('details', '')
        ])
    
    headers = ['Timestamp', 'Store', 'Action', 'Details']
    print(tabulate(table_data, headers=headers, tablefmt='plain'))

def cmd_superadmin_create(args):
    """Create a new superadmin user"""
    username = args.username
    
    # Check if already exists
    with get_db() as db:
        existing = db.execute("SELECT id FROM superadmins WHERE username = ?", (username,)).fetchone()
        if existing:
            print(f"Error: Superadmin '{username}' already exists!")
            sys.exit(1)
        
        # Generate secure password
        password = secrets.token_urlsafe(24)  # ~32 chars
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        # Create superadmin
        db.execute(
            "INSERT INTO superadmins (username, password_hash) VALUES (?, ?)",
            (username, password_hash)
        )
        db.commit()
        
        print(f"\n✅ Superadmin created successfully!")
        print(f"Username: {username}")
        print(f"Password: {password}")
        print(f"\n⚠️  IMPORTANT: Store this password in your password manager!")
        print(f"This password cannot be recovered - only reset.\n")

def cmd_superadmin_reset_password(args):
    """Reset superadmin password"""
    username = args.username
    
    with get_db() as db:
        # Check if exists
        existing = db.execute("SELECT id FROM superadmins WHERE username = ?", (username,)).fetchone()
        if not existing:
            print(f"Error: Superadmin '{username}' not found!")
            sys.exit(1)
        
        # Confirm reset
        confirm = input(f"Reset password for superadmin '{username}'? (yes/no): ")
        if confirm.lower() != 'yes':
            print("Cancelled.")
            return
        
        # Generate new password
        password = secrets.token_urlsafe(24)  # ~32 chars
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        # Update password
        db.execute(
            "UPDATE superadmins SET password_hash = ? WHERE username = ?",
            (password_hash, username)
        )
        db.commit()
        
        print(f"\n✅ Password reset successfully!")
        print(f"Username: {username}")
        print(f"New Password: {password}")
        print(f"\n⚠️  IMPORTANT: Store this password in your password manager!\n")

def cmd_superadmin_list(args):
    """List all superadmin users"""
    with get_db() as db:
        admins = db.execute("""
            SELECT username, created_at, last_login, totp_enabled 
            FROM superadmins 
            ORDER BY username
        """).fetchall()
        
        if not admins:
            print("No superadmin users found.")
            return
        
        table_data = []
        for admin in admins:
            table_data.append([
                admin['username'],
                admin['created_at'],
                admin['last_login'] or 'Never',
                '✓' if admin['totp_enabled'] else '✗'
            ])
        
        print("\n", tabulate(table_data, headers=['Username', 'Created', 'Last Login', '2FA'], tablefmt='grid'))

def cmd_superadmin_disable_totp(args):
    """Disable TOTP for a superadmin user"""
    username = args.username
    
    with get_db() as db:
        # Check if exists
        existing = db.execute("SELECT id, totp_enabled FROM superadmins WHERE username = ?", (username,)).fetchone()
        if not existing:
            print(f"Error: Superadmin '{username}' not found!")
            sys.exit(1)
        
        if not existing['totp_enabled']:
            print(f"TOTP is already disabled for '{username}'")
            return
        
        # Confirm action
        confirm = input(f"Disable TOTP for superadmin '{username}'? (yes/no): ")
        if confirm.lower() != 'yes':
            print("Cancelled.")
            return
        
        # Disable TOTP
        db.execute(
            "UPDATE superadmins SET totp_enabled = FALSE, totp_secret = NULL WHERE username = ?",
            (username,)
        )
        db.commit()
        
        print(f"\n✅ TOTP disabled for '{username}'")
        print(f"They can now login with just username and password.\n")

def cmd_superadmin_reset_totp(args):
    """Reset TOTP for a superadmin user (disable and clear secret)"""
    username = args.username
    
    with get_db() as db:
        # Check if exists
        existing = db.execute("SELECT id FROM superadmins WHERE username = ?", (username,)).fetchone()
        if not existing:
            print(f"Error: Superadmin '{username}' not found!")
            sys.exit(1)
        
        # Confirm action
        confirm = input(f"Reset TOTP for superadmin '{username}'? This will disable 2FA. (yes/no): ")
        if confirm.lower() != 'yes':
            print("Cancelled.")
            return
        
        # Reset TOTP
        db.execute(
            "UPDATE superadmins SET totp_enabled = FALSE, totp_secret = NULL WHERE username = ?",
            (username,)
        )
        db.commit()
        
        print(f"\n✅ TOTP reset for '{username}'")
        print(f"They will need to set up 2FA again from the security settings.\n")

def cmd_superadmin_totp_status(args):
    """Check TOTP status for a superadmin user"""
    username = args.username
    
    with get_db() as db:
        # Get user info
        admin = db.execute(
            "SELECT username, totp_enabled, created_at, last_login FROM superadmins WHERE username = ?",
            (username,)
        ).fetchone()
        
        if not admin:
            print(f"Error: Superadmin '{username}' not found!")
            sys.exit(1)
        
        print(f"\n📋 TOTP Status for '{username}':")
        print(f"2FA Enabled: {'✅ Yes' if admin['totp_enabled'] else '❌ No'}")
        print(f"Created: {admin['created_at']}")
        print(f"Last Login: {admin['last_login'] or 'Never'}")
        
        if admin['totp_enabled']:
            print("\n💡 To disable TOTP, use: ./tools/auth superadmin disable-totp " + username)
        else:
            print("\n💡 TOTP can be enabled from the web interface security settings.")

def main():
    parser = argparse.ArgumentParser(
        description='Manage store authentication for Packing Website'
    )
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # init command
    parser_init = subparsers.add_parser('init', help='Initialize the database')
    parser_init.set_defaults(func=cmd_init)
    
    # create command
    parser_create = subparsers.add_parser(
        'create', 
        help='Create store authentication'
    )
    parser_create.add_argument('store', help='Store ID (e.g., 1, 2, 3)')
    parser_create.add_argument('email', help='Admin email address')
    parser_create.set_defaults(func=cmd_create)
    
    # regenerate-pin command
    parser_regen = subparsers.add_parser(
        'regenerate-pin',
        help='Regenerate PIN for a store'
    )
    parser_regen.add_argument('store', help='Store ID')
    parser_regen.add_argument(
        '-f', '--force',
        action='store_true',
        help='Force regeneration without confirmation'
    )
    parser_regen.set_defaults(func=cmd_regenerate_pin)
    
    # modify-email command
    parser_modify_email = subparsers.add_parser(
        'modify-email',
        help='Modify admin email for a store'
    )
    parser_modify_email.add_argument('store', help='Store ID')
    parser_modify_email.add_argument('email', help='New admin email address')
    parser_modify_email.add_argument(
        '-f', '--force',
        action='store_true',
        help='Force modification without confirmation'
    )
    parser_modify_email.set_defaults(func=cmd_modify_email)
    
    # list command
    parser_list = subparsers.add_parser('list', help='List all stores with authentication')
    parser_list.set_defaults(func=cmd_list)
    
    # verify command
    parser_verify = subparsers.add_parser(
        'verify', 
        help='Verify a store PIN'
    )
    parser_verify.add_argument('store', help='Store ID')
    parser_verify.set_defaults(func=cmd_verify)
    
    # audit command
    parser_audit = subparsers.add_parser('audit', help='Show audit log')
    parser_audit.add_argument(
        '-s', '--store', 
        help='Filter by store ID'
    )
    parser_audit.add_argument(
        '-l', '--limit', 
        type=int, 
        default=50,
        help='Number of entries to show (default: 50)'
    )
    parser_audit.set_defaults(func=cmd_audit)
    
    # superadmin subcommand
    parser_superadmin = subparsers.add_parser('superadmin', help='Manage superadmin users')
    superadmin_subparsers = parser_superadmin.add_subparsers(dest='superadmin_command')
    
    # superadmin create
    parser_sa_create = superadmin_subparsers.add_parser('create', help='Create a superadmin user')
    parser_sa_create.add_argument('username', help='Superadmin username')
    parser_sa_create.set_defaults(func=cmd_superadmin_create)
    
    # superadmin reset-password
    parser_sa_reset = superadmin_subparsers.add_parser('reset-password', help='Reset superadmin password')
    parser_sa_reset.add_argument('username', help='Superadmin username')
    parser_sa_reset.set_defaults(func=cmd_superadmin_reset_password)
    
    # superadmin list
    parser_sa_list = superadmin_subparsers.add_parser('list', help='List all superadmins')
    parser_sa_list.set_defaults(func=cmd_superadmin_list)
    
    # superadmin disable-totp
    parser_sa_disable_totp = superadmin_subparsers.add_parser('disable-totp', help='Disable TOTP for a superadmin')
    parser_sa_disable_totp.add_argument('username', help='Superadmin username')
    parser_sa_disable_totp.set_defaults(func=cmd_superadmin_disable_totp)
    
    # superadmin reset-totp
    parser_sa_reset_totp = superadmin_subparsers.add_parser('reset-totp', help='Reset TOTP for a superadmin')
    parser_sa_reset_totp.add_argument('username', help='Superadmin username')
    parser_sa_reset_totp.set_defaults(func=cmd_superadmin_reset_totp)
    
    # superadmin totp-status
    parser_sa_totp_status = superadmin_subparsers.add_parser('totp-status', help='Check TOTP status for a superadmin')
    parser_sa_totp_status.add_argument('username', help='Superadmin username')
    parser_sa_totp_status.set_defaults(func=cmd_superadmin_totp_status)
    
    # Parse arguments
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    # Handle superadmin command without subcommand
    if args.command == 'superadmin' and not hasattr(args, 'superadmin_command'):
        parser_superadmin.print_help()
        sys.exit(1)
    
    if args.command == 'superadmin' and not args.superadmin_command:
        parser_superadmin.print_help()
        sys.exit(1)
    
    # Execute the command
    args.func(args)

if __name__ == "__main__":
    main()