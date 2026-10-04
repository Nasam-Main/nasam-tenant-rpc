FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:22-alpine AS release
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/proto ./proto
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
CMD ["node", "-e", "require('./dist/index.js'); console.log('@nasam/tenant-rpc ready'); setInterval(() => {}, 1 << 30);"]
