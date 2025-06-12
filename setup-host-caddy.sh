#!/bin/sh
# Setup script for host Caddy on Alpine Linux

# Add HTTP and HTTPS.  Don't need this for Docker, since it's higher priority than UFW
ufw allow 80/tcp
ufw allow 443/tcp


# Install Caddy
apk add caddy

# Create minimal Caddyfile
  cat > /etc/caddy/Caddyfile << 'EOF'
  {
      email admin@boxchooser.com
  }

  # Handle both www and non-www
  boxchooser.com, www.boxchooser.com {
      # TLS configuration - Let's Encrypt will auto-provision certificates for both domains
      # For staging/testing, uncomment the next line:
      # tls {
      #     ca https://acme-staging-v02.api.letsencrypt.org/directory
      # }

      # Security headers for HTTPS
      header {
          # HSTS - since we handle TLS here
          Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
      }

      # Redirect www to non-www (canonical domain)
      @www host www.boxchooser.com
      redir @www https://boxchooser.com{uri} permanent

      # Only proxy for the canonical domain
      @canonical host boxchooser.com
      reverse_proxy @canonical localhost:5893 {
          # Strip any incoming forwarded headers to prevent spoofing
          header_up -X-Real-IP
          header_up -X-Forwarded-For
          header_up -X-Forwarded-Proto

          # Add the real client information
          header_up X-Real-IP {remote_host}
          header_up X-Forwarded-For {remote_host}
          header_up X-Forwarded-Proto https
          header_up Host {host}
      }
  }

  :80 {
      redir https://{host}{uri} permanent
  }
  EOF

# Enable and start Caddy service
rc-update add caddy
rc-service caddy start

# Check status
rc-service caddy status