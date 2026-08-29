FROM node:20-slim

# Install Python, pip, ffmpeg + python-is-python3 (python -> python3 symlink)
RUN apt-get update && \
    apt-get install -y python3 python3-pip python-is-python3 ffmpeg curl && \
    pip3 install --break-system-packages -U yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 3000

ENV PORT=3000

CMD ["node", "index.js"]