FROM node:22-bookworm-slim

# 安装编译 better-sqlite3 需要的依赖
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先复制 package.json 安装依赖（利用缓存）
COPY server/package*.json ./server/
RUN cd server && npm install

# 复制所有代码
COPY . .

# 创建上传目录
RUN mkdir -p /data/uploads

EXPOSE 3000

ENV NODE_OPTIONS="--no-warnings"

CMD ["node", "server/server.js"]
