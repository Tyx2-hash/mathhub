FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Build frontend
COPY app/package*.json ./app/
RUN cd app && npm install

# Build server
COPY server/package*.json ./server/
RUN cd server && npm install

# Copy all source
COPY . .

# Build frontend dist
RUN cd app && npx vite build

RUN mkdir -p /data/uploads
EXPOSE 3000
CMD ["node", "server/server.js"]
