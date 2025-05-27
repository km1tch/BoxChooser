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

from lib.auth_manager import (
    init_db, create_store_auth, list_stores, 
    get_audit_log, verify_pin, hasAuth,
    get_store_info, regenerate_pin
)

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
        print(f"Error: Store configuration file 'stores/store{store_id}.yml' not found!")
        print(f"Please create the store configuration file before setting up authentication.")
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
    print(tabulate(table_data, headers=headers, tablefmt='grid'))

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
    print(tabulate(table_data, headers=headers, tablefmt='grid'))

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
    
    # Parse arguments
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    # Execute the command
    args.func(args)

if __name__ == "__main__":
    main()