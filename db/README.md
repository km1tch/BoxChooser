# Database Directory

This directory is used to store SQLite database files for the Packing Website application. It should be bind-mounted into the container

## Authentication Database

The authentication database is stored here as `packing.db`. This database is automatically initialized when the Docker container starts.

## Managing Authentication

For all authentication-related operations, use the `./tools/auth` wrapper script on the host. This script automatically runs the `tools/manage_auth.py` Python script inside the Docker container:

```bash
# Create authentication for a store
./tools/auth create 1

# Update an existing store's password
./tools/auth update 1

# List all stores with authentication
./tools/auth list

# Verify a password
./tools/auth verify 1

# View audit log
./tools/auth audit
```

Note: The Docker container must be running for these commands to work. If you get an error about the container not running, start it first with `docker compose up -d`.

## Docker Environment

When running in Docker, the database is mounted as a volume at `/db` in the container, which maps to this directory on the host.

The database path can be customized by setting the `SQLITE_DB_PATH` environment variable.
