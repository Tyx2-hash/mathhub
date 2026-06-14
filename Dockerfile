FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm install
COPY . .
RUN mkdir -p /data/uploads
EXPOSE 3000
CMD ["node", "server/server.js"]
