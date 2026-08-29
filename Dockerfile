# Base image - Node.js with slim Debian
FROM node:20-slim

# Install Python, pip, ffmpeg (yt-dlp na dependencies)
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg curl && \
    pip3 install --break-system-packages -U yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Working directory container ma
WORKDIR /app

# Package files pehla copy karo (caching mate)
COPY package*.json ./

# Dependencies install karo
RUN npm install --production

# Baki nu badhu code copy karo
COPY . .

# App je port per chale che
EXPOSE 3000

# Environment variable (optional, platform overwrite kari shake)
ENV PORT=3000

# App start karva no command
CMD ["node", "index.js"]