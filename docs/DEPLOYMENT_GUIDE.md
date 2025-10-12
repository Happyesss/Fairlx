# Digital Ocean Deployment Guide

This guide walks you through deploying the Fairlx application to Digital Ocean using GitHub Actions and Docker.

## Overview

The deployment process:
1. **GitHub Actions** builds a Docker image and pushes to Docker Hub
2. **SSH Action** connects to your Digital Ocean droplet
3. **Docker** pulls and runs the latest image on your server
4. **Nginx** (optional) acts as a reverse proxy

## Prerequisites

✅ **Already Done:**
- Docker Hub account and repository
- GitHub repository with CI/CD workflows
- Digital Ocean droplet created

🔧 **Need to Setup:**
- Configure GitHub repository secrets
- Setup Digital Ocean server environment
- Configure domain (optional)

## Step 1: Setup Digital Ocean Server

### Option A: Automated Setup (Recommended)

Run the PowerShell script from your local machine:

```powershell
.\scripts\setup-remote-server.ps1
```

### Option B: Manual Setup

1. **Connect to your droplet:**
   ```bash
   ssh root@143.110.254.212
   # Password: Fairlx@123Vps
   ```

2. **Upload and run setup script:**
   ```bash
   # On your local machine
   scp scripts/setup-digital-ocean-server.sh root@143.110.254.212:/tmp/
   
   # On the server
   ssh root@143.110.254.212
   chmod +x /tmp/setup-digital-ocean-server.sh
   bash /tmp/setup-digital-ocean-server.sh
   ```

## Step 2: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

| Secret Name | Value | Description |
|------------|-------|-------------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username | For pushing Docker images |
| `DOCKERHUB_TOKEN` | Your Docker Hub token | Authentication for Docker Hub |
| `DO_HOST` | `143.110.254.212` | Your droplet's IP address |
| `DO_USERNAME` | `root` | SSH username |
| `DO_PASSWORD` | `Fairlx@123Vps` | SSH password |
| `DO_PORT` | `22` | SSH port |

## Step 3: Deploy Your Application

### Automatic Deployment

Push code to the `main` branch to trigger automatic deployment:

```bash
git add .
git commit -m "Deploy to Digital Ocean"
git push origin main
```

### Manual Deployment

If you need to deploy manually on the server:

```bash
# Connect to your server
ssh root@143.110.254.212

# Run manual deployment script
cd /opt/fairlx
./deploy.sh your-dockerhub-username latest
```

## Step 4: Access Your Application

After successful deployment, your application will be available at:

- **Direct Access:** http://143.110.254.212:3000
- **Via Nginx Proxy:** http://143.110.254.212
- **With Domain:** http://yourdomain.com (after DNS setup)

## Monitoring and Troubleshooting

### Check Application Status

```bash
# Check if container is running
docker ps

# View application logs
docker logs fairlx-app

# Check Nginx status
systemctl status nginx

# View Nginx logs
tail -f /var/log/nginx/error.log
```

### Common Issues

#### 1. Container Not Starting
```bash
# Check logs
docker logs fairlx-app

# Check if port is in use
netstat -tlnp | grep :3000
```

#### 2. GitHub Actions Failing
- Verify all secrets are correctly configured
- Check Actions logs in GitHub
- Ensure Docker Hub credentials are valid

#### 3. Cannot Access Application
```bash
# Check if port 3000 is open
ufw status

# Check if Nginx is running
systemctl status nginx

# Test local access
curl http://localhost:3000
```

## Security Recommendations

### 1. Setup SSH Key Authentication
```bash
# On your local machine, generate SSH key
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# Copy public key to server
ssh-copy-id root@143.110.254.212

# Disable password authentication
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart ssh
```

### 2. Setup Firewall Rules
```bash
# Configure UFW (already done in setup script)
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### 3. Regular Updates
```bash
# Update system packages
apt update && apt upgrade -y

# Update Docker images
docker pull your-dockerhub-username/fairlx:latest
```

## SSL/HTTPS Setup (Optional)

### Using Let's Encrypt with Certbot

1. **Install Certbot:**
   ```bash
   apt install certbot python3-certbot-nginx
   ```

2. **Get SSL Certificate:**
   ```bash
   certbot --nginx -d yourdomain.com
   ```

3. **Auto-renewal:**
   ```bash
   crontab -e
   # Add: 0 12 * * * /usr/bin/certbot renew --quiet
   ```

## Scaling and Optimization

### Docker Compose (Advanced)

For more complex setups, create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  app:
    image: your-dockerhub-username/fairlx:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_TELEMETRY_DISABLED=1
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Load Balancer Setup

For multiple instances:

```bash
# Run multiple containers
docker run -d --name fairlx-app-1 -p 3001:3000 your-image
docker run -d --name fairlx-app-2 -p 3002:3000 your-image

# Update Nginx config for load balancing
upstream fairlx_backend {
    server localhost:3001;
    server localhost:3002;
}
```

## Backup Strategy

### Database Backups
If you add a database later, setup automated backups:

```bash
# Create backup script
cat > /opt/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec database-container mysqldump -u user -p database > /opt/backups/db_$DATE.sql
EOF
```

### File Backups
```bash
# Backup uploaded files
tar -czf /opt/backups/files_$(date +%Y%m%d).tar.gz /opt/fairlx/uploads/
```

## Support and Maintenance

### Log Rotation
```bash
# Setup logrotate for Docker logs
cat > /etc/logrotate.d/docker << 'EOF'
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  size 10M
  missingok
  delaycompress
  copytruncate
}
EOF
```

### Monitoring Scripts
```bash
# Create health check script
cat > /opt/health-check.sh << 'EOF'
#!/bin/bash
if ! curl -f http://localhost:3000 > /dev/null 2>&1; then
  echo "Application down, restarting..."
  docker restart fairlx-app
fi
EOF

chmod +x /opt/health-check.sh

# Add to crontab
echo "*/5 * * * * /opt/health-check.sh" | crontab -
```

## Next Steps

1. ✅ **Setup DNS** (if using custom domain)
2. ✅ **Configure SSL/HTTPS** 
3. ✅ **Setup monitoring** (Uptime Kuma, etc.)
4. ✅ **Configure backups**
5. ✅ **Setup staging environment**

## Useful Commands

```bash
# View all running containers
docker ps -a

# Restart application
docker restart fairlx-app

# Update application
cd /opt/fairlx && ./deploy.sh

# Check disk space
df -h

# Check memory usage
free -m

# Check server load
htop
```

---

🎉 **Congratulations!** Your Fairlx application is now deployed on Digital Ocean with automated CI/CD!