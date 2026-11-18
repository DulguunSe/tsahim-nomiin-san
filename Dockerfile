# Railway, Fly.io, VPS зэрэг Docker дэмждэг хостингт зориулсан.
# Байнгын дискээ (volume) /data руу холбоно уу.
FROM node:22-alpine

ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3000

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
RUN mkdir -p /data

EXPOSE 3000
CMD ["node", "server.js"]
