FROM node:22-alpine

# 安装编译 better-sqlite3 需要的依赖
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 先复制 package.json 安装依赖（利用缓存）
COPY server/package*.json ./server/
RUN cd server && npm install

# 复制所有代码
COPY . .

# 创建上传目录
RUN mkdir -p /data/uploads

EXPOSE 3000

# 强制 Node.js 版本不低于 20
ENV NODE_OPTIONS="--no-warnings"

CMD ["node", "server/server.js"]
