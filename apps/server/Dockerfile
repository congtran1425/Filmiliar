FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json
RUN npm ci
COPY apps/server/prisma apps/server/prisma
COPY apps/server/tsconfig.json apps/server/tsconfig.json
COPY apps/server/src apps/server/src
RUN npx prisma generate --schema=apps/server/prisma/schema.prisma && npm run build:server

FROM node:22-bookworm-slim
ARG APP_REVISION=development
ENV NODE_ENV=production
ENV APP_REVISION=${APP_REVISION}
LABEL org.opencontainers.image.source="https://github.com/congtran1425/Filmiliar" \
      org.opencontainers.image.revision="${APP_REVISION}"
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/uploads && chown node:node /app/uploads
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/server/dist /app/apps/server/dist
COPY --from=build /app/apps/server/prisma /app/apps/server/prisma
COPY --from=build /app/apps/server/package.json /app/apps/server/package.json
COPY apps/server/tests /app/apps/server/tests
USER node
EXPOSE 5000
CMD ["node", "apps/server/dist/index.js"]
