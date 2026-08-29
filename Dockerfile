FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Bypass binary download issue during npm install
ENV YTDLP_SKIP_PYTHON_CHECK=true

RUN npm install --unsafe-perm

# Copy rest of the code
COPY . .

EXPOSE 3000
CMD ["npm", "start"]