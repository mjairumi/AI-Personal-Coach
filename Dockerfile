FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --include=dev
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
CMD ["npm", "start"]
