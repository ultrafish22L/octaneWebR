# octaneWebR Production Dockerfile
# Multi-stage build for minimal production image

# Stage 1: Build the application
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.mts ./
COPY vite-plugin-octane-grpc.ts ./

# Copy source code
COPY client/ ./client/
COPY server/ ./server/

# Install dependencies
RUN npm ci --production=false

# Build production bundle
RUN npm run build

# Stage 2: Production image with only built files
FROM nginx:alpine AS production

# Copy built files to nginx
COPY --from=builder /app/dist/client /usr/share/nginx/html

# Create custom nginx config
RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 43930;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    
    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

EXPOSE 43930

CMD ["nginx", "-g", "daemon off;"]
