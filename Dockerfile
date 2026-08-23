FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --production

COPY src ./src

EXPOSE 3000

ENV NODE_ENV=production
ENV PGVECTOR_VERSION=0.5.0

CMD ["node", "src/api/index.js"]