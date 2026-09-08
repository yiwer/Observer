# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24.18.0-bookworm-slim
ARG DOCKER_CLI_IMAGE=docker:28.5.2-cli
FROM ${DOCKER_CLI_IMAGE} AS docker-cli
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json ./
COPY scripts/copy-runtime-assets.mjs ./scripts/copy-runtime-assets.mjs
COPY src ./src
RUN npm run build && npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM ${NODE_IMAGE} AS application
ARG RELEASE_ID
RUN test -n "$RELEASE_ID" && node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a!==24||b<18) process.exit(1)'
RUN apt-get update && apt-get install --no-install-recommends -y util-linux ca-certificates && apt-get clean
ENV NODE_ENV=production OBSERVER_RELEASE_ID=${RELEASE_ID}
WORKDIR /app
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY assets/fonts ./assets/fonts
USER 10001:10001
EXPOSE 3000
CMD ["flock", "--exclusive", "--nonblock", "--no-fork", "/var/lib/observer/service.lock", "node", "dist/main.js"]
