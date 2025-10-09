#!/bin/bash

# Digital Ocean Droplet Setup Script for Fairlx Application
# Run this script on your Digital Ocean droplet to set up the environment

set -e

echo "🚀 Setting up Digital Ocean droplet for Fairlx application..."

# Update system packages
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Docker
echo "🐳 Installing Docker..."
apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start and enable Docker service
systemctl start docker
systemctl enable docker

# Add current user to docker group (if not root)
if [ "$USER" != "root" ]; then
    usermod -aG docker $USER
fi

# Install Docker Compose (standalone)
echo "📋 Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create directory for application
echo "📁 Creating application directory..."
mkdir -p /opt/fairlx
cd /opt/fairlx

# Setup firewall rules
echo "🔥 Configuring firewall..."
ufw allow ssh
ufw allow 3000/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Create a simple nginx proxy configuration (optional)
echo "🌐 Setting up Nginx reverse proxy..."
apt install -y nginx

# Create Nginx configuration for reverse proxy
cat > /etc/nginx/sites-available/fairlx << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/fairlx /etc/nginx/sites-enabled/fairlx
rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
nginx -t
systemctl restart nginx
systemctl enable nginx

# Create a deployment script for easy manual deployment
cat > /opt/fairlx/deploy.sh << 'EOF'
#!/bin/bash

# Manual deployment script for Fairlx
set -e

DOCKERHUB_USERNAME=${1:-"your-dockerhub-username"}
IMAGE_TAG=${2:-"latest"}

echo "🚀 Deploying Fairlx application..."
echo "Docker Hub Username: $DOCKERHUB_USERNAME"
echo "Image Tag: $IMAGE_TAG"

# Stop and remove existing container if it exists
echo "🛑 Stopping existing container..."
docker stop fairlx-app || true
docker rm fairlx-app || true

# Remove old image to save space
echo "🗑️  Removing old image..."
docker rmi $DOCKERHUB_USERNAME/fairlx:$IMAGE_TAG || true

# Pull the latest image
echo "📦 Pulling latest image..."
docker pull $DOCKERHUB_USERNAME/fairlx:$IMAGE_TAG

# Run the new container
echo "🏃 Starting new container..."
docker run -d \
  --name fairlx-app \
  --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e NEXT_TELEMETRY_DISABLED=1 \
  $DOCKERHUB_USERNAME/fairlx:$IMAGE_TAG

# Clean up unused Docker images
echo "🧹 Cleaning up..."
docker image prune -f

# Wait for container to start
echo "⏳ Waiting for container to start..."
sleep 10

# Check if the container is running
if docker ps | grep -q fairlx-app; then
  echo "✅ Deployment successful! Container is running."
  echo "🌐 Application URL: http://$(curl -s ifconfig.me):3000"
  echo "🌐 Nginx Proxy URL: http://$(curl -s ifconfig.me)"
else
  echo "❌ Deployment failed! Container is not running."
  echo "📋 Container logs:"
  docker logs fairlx-app
  exit 1
fi
EOF

chmod +x /opt/fairlx/deploy.sh

# Create a systemd service for automatic startup (optional)
cat > /etc/systemd/system/fairlx.service << 'EOF'
[Unit]
Description=Fairlx Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/docker start fairlx-app
ExecStop=/usr/bin/docker stop fairlx-app
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Enable the service
systemctl daemon-reload
systemctl enable fairlx.service

echo "✅ Digital Ocean droplet setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Configure your GitHub repository secrets:"
echo "   - DO_HOST: $(curl -s ifconfig.me)"
echo "   - DO_USERNAME: root (or your username)"
echo "   - DO_PASSWORD: your-password"
echo "   - DO_PORT: 22"
echo "   - DOCKERHUB_USERNAME: your-dockerhub-username"
echo "   - DOCKERHUB_TOKEN: your-dockerhub-token"
echo ""
echo "2. Push your code to trigger the deployment"
echo ""
echo "3. Access your application at:"
echo "   - Direct: http://$(curl -s ifconfig.me):3000"
echo "   - Via Nginx: http://$(curl -s ifconfig.me)"
echo ""
echo "🔧 Manual deployment: /opt/fairlx/deploy.sh [dockerhub-username] [tag]"