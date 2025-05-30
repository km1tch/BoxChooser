#!/bin/sh
# Setup script for host Caddy on Alpine Linux

# Install Caddy
apk add caddy

# Create minimal Caddyfile
cat > /etc/caddy/Caddyfile << 'EOF'
{
    email ${ACME_EMAIL:-admin@boxchooser.com}
}

${SITE_URL:-boxchooser.com} {
    # TLS configuration - Let's Encrypt will auto-provision certificates
    # For staging/testing, uncomment the next line:
    # tls {
    #     ca https://acme-staging-v02.api.letsencrypt.org/directory
    # }
    
    # Security headers for HTTPS
    header {
        # HSTS - since we handle TLS here
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    }
    
    reverse_proxy localhost:5893 {
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