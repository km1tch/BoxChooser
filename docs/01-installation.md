# Installation Guide

This guide covers installing BoxChooser for development and production use.

## Prerequisites

- Docker and Docker Compose

## Quick Start (Docker - Recommended)

1. **Clone the repository**

   ```bash
   git clone https://github.com/km1tch/BoxChooser.git
   cd BoxChooser
   ```

2. **Start the application**

   ```bash
   docker compose up
   ```

3. **Access the application**
   - Application: http://localhost:5893
   - MailHog (email testing): http://localhost:8026

## First-Time Setup

### 1. Create Your First Store

The demo store (999999) is created automatically. To create your own store:

```bash
# Create store 100 with an admin email
./tools/auth create 100 admin@yourcompany.com

# Save the generated PIN! Your staff will need it to log in.
```

This command will:

- Create authentication for the store
- Generate a minimal `stores/store100.yml` file if it doesn't exist
- Return a PIN for staff access

### 2. Configure Your Store

You can configure your store's box inventory using either the command line or the web interface.

#### Option A: Using the Command Line

Edit the auto-generated YAML file to add your box inventory:

```bash
# Edit the store configuration file
vi stores/store100.yml
```

Add boxes and prices to the `boxes:` section following this format:

```yaml
boxes:
  - type: NormalBox
    supplier: ULINE
    model: "S-4344"
    dimensions: [12, 9, 6] # Length, Width, Height
    itemized-prices:
      box-price: 1.50
      basic-materials: 0.25
      basic-services: 0.75
      standard-materials: 0.50
      standard-services: 1.50
      fragile-materials: 1.00
      fragile-services: 3.00
      custom-materials: 1.50
      custom-services: 4.50
```

See [Store Configuration Guide](03-store-configuration.md) for the complete YAML format reference.

#### Option B: Using the Web Interface (Recommended)

1. **Import boxes from vendor catalog** (if using an existing vendor):

   - Log in as admin
   - Go to **Vendor Catalog**
   - Select boxes from the ABC catalog
   - Click **Import Selected** to add them to your store

2. **Add custom boxes** (if needed):

   - Go to **Box Management**
   - Click **Add Custom Box** and enter dimensions and details

3. **Set box prices**:

   - Go to **Edit Prices**
   - For each box, enter prices for:
     - Basic packing
     - Standard packing
     - Fragile packing
     - Custom packing
   - Click **Save All Changes**

4. **Verify your configuration**:
   - Test a calculation to ensure prices are working

### 3. Log In

- **Staff**: Go to http://localhost:5893/login and enter the PIN
- **Admin**: Go to http://localhost:5893/login, select "Admin Login", and enter your email

## Production Installation

### Using Docker Compose

1. Set up HTTPS. Out of scope for this document

2. **Create environment file**

   ```bash
   cp .env.example .env
   # Edit .env with your production settings, incl email
   ```

3. **Start production stack**
   ```bash
   docker compose -f docker-compose.production.yaml up -d
   ```

## Troubleshooting

### Port Conflicts

If ports 5893, 8000, or 8080 are in use, modify `docker-compose.yaml`:

```yaml
services:
  caddy:
    ports:
      - "5894:80" # Change 5893 to another port
```

### Database Issues

If you encounter database errors:

1. Stop the application
2. Remove the database: `rm db/packing.db`
3. Restart the application (database will be recreated)

### Email Not Working

For local development, all emails are captured by MailHog at http://localhost:8026

For production:

- Verify SMTP settings in `.env`
- Check firewall rules for SMTP port
- Ensure EMAIL_FROM_ADDRESS is authorized by your SMTP provider

## Next Steps

- [Authentication Setup](02-auth-setup.md) - Create stores and manage users
- [Store Configuration](03-store-configuration.md) - Configure box inventory and settings
- [Architecture Overview](04-architecture.md) - Understand the system design
