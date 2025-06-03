"""
Email service for sending login codes
SMTP only - no third-party email services
"""
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

logger = logging.getLogger("email_service")

# SMTP configuration from environment variables
SMTP_HOST = os.getenv("SMTP_HOST", "mailhog")
SMTP_PORT = int(os.getenv("SMTP_PORT", "1025"))
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "false").lower() == "true"
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@packingsite.com")

# Site configuration
SITE_NAME = os.getenv("SITE_NAME", "Packing Site")


def send_email_smtp(to_email: str, subject: str, body: str, html_body: Optional[str] = None) -> bool:
    """Send email via SMTP"""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to_email
        
        msg.attach(MIMEText(body, "plain"))
        if html_body:
            msg.attach(MIMEText(html_body, "html"))
        
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            if SMTP_USE_TLS:
                server.starttls()
            
            if SMTP_USERNAME and SMTP_PASSWORD:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
            
            server.send_message(msg)
            
        logger.info(f"Email sent to {to_email} via SMTP")
        return True
        
    except Exception as e:
        logger.error(f"SMTP error sending email: {str(e)}")
        return False


def send_email(to_email: str, subject: str, body: str, html_body: Optional[str] = None) -> bool:
    """Send email via SMTP"""
    return send_email_smtp(to_email, subject, body, html_body)


def send_login_code(to_email: str, code: str, store_name: str = "") -> bool:
    """Send login verification code"""
    subject = f"Your {SITE_NAME} Login Code"
    
    store_text = f" for {store_name}" if store_name else ""
    
    body = f"""Your verification code{store_text} is: {code}

This code expires in 5 minutes.

If you didn't request this code, please ignore this email."""
    
    html_body = f"""<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
        .content {{ background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }}
        .code {{ font-size: 32px; font-weight: bold; color: #2c3e50; text-align: center; 
                 padding: 20px; margin: 20px 0; background: white; border: 2px solid #3498db; 
                 border-radius: 5px; letter-spacing: 5px; }}
        .footer {{ font-size: 12px; color: #777; margin-top: 20px; text-align: center; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{SITE_NAME} Login</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Your verification code{store_text} is:</p>
            <div class="code">{code}</div>
            <p><strong>This code expires in 5 minutes.</strong></p>
            <p>If you didn't request this code, please ignore this email.</p>
            <div class="footer">
                This is an automated message. Please do not reply to this email.
            </div>
        </div>
    </div>
</body>
</html>"""
    
    return send_email(to_email, subject, body, html_body)