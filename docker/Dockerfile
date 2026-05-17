# syntax=docker/dockerfile:1
# opencomfy-hub：单 Dockerfile，多 stage / 多 target。
# 单独镜像：--target 与 --build-arg BUILD_TARGET 须一致（web|docs|api）。
# 三合一：--target all --build-arg BUILD_TARGET=all
# 亦可用 docker/docker-compose.build.yml

ARG NODE_VERSION=24-alpine
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

ARG PNPM_VERSION=10.33.0
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# turbo.json globalEnv：构建期占位，避免缓存抖动；生产运行时用 compose/k8s 覆盖
ARG BUILD_TARGET=web
ENV BUILD_TARGET=${BUILD_TARGET} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres \
    BETTER_AUTH_SECRET=01234567890123456789012345678901 \
    BETTER_AUTH_URL=http://127.0.0.1:3000 \
    BETTER_AUTH_TRUSTED_ORIGINS= \
    LIBLIB_API_KEY=build \
    LIBLIB_API_SECRET=build \
    LIBLIB_OPENAPI_BASE_URL=http://127.0.0.1 \
    MISTRAL_API_KEY=build \
    PORT=8080

COPY . .

RUN apk add --no-cache ca-certificates

RUN pnpm install --frozen-lockfile --config.package-import-method=copy

RUN set -eux; \
    case "${BUILD_TARGET}" in \
        web)  pnpm exec turbo build --filter=dashboard ;; \
        docs) pnpm exec turbo build --filter=doc ;; \
        api)  pnpm exec turbo build --filter=api ;; \
        all)  pnpm exec turbo build --filter=dashboard --filter=doc --filter=api ;; \
        *) echo "Unknown BUILD_TARGET=${BUILD_TARGET} (use web|docs|api|all)"; exit 1 ;; \
    esac

# Next standalone：物化符号链接，避免复制镜像后断链（与 apps/web/build.sh 一致）
RUN set -eux; \
    materialize_standalone() { \
        _root="$1"; \
        _st="${_root}/.next/standalone"; \
        if [ ! -d "${_st}" ]; then return 0; fi; \
        _tmp="${_st}_materialized_$$$$"; \
        rm -rf "${_tmp}"; \
        cp -a "${_st}" "${_tmp}"; \
        rm -rf "${_st}"; \
        mv "${_tmp}" "${_st}"; \
    }; \
    materialize_standalone apps/web; \
    materialize_standalone apps/docs; \
    if [ -d apps/web/.next/standalone ]; then \
        if [ -d apps/web/bin ]; then cp -f apps/web/bin/* apps/web/.next/standalone/ 2>/dev/null || true; fi; \
        mkdir -p apps/web/.next/standalone/apps/web; \
        cp -r apps/web/public apps/web/.next/standalone/apps/web/; \
        mkdir -p apps/web/.next/standalone/apps/web/.next; \
        cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/; \
    fi; \
    if [ -d apps/docs/.next/standalone ]; then \
        mkdir -p apps/docs/.next/standalone/apps/docs/.next; \
        if [ -d apps/docs/.next/static ]; then \
            cp -r apps/docs/.next/static apps/docs/.next/standalone/apps/docs/.next/; \
        fi; \
    fi

# API 生产目录（pnpm deploy）
RUN set -eux; \
    case "${BUILD_TARGET}" in \
        api|all) pnpm deploy --legacy --filter=api --prod /opt/api-deploy ;; \
        *) mkdir -p /opt/api-deploy ;; \
    esac


# ---------- Web ----------
ARG NODE_VERSION=24-alpine
FROM node:${NODE_VERSION} AS web

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
# get-page.ts：process.cwd() + content（changelog / 法律页等 MDX）
COPY --from=builder /app/apps/web/content ./content

RUN mkdir -p apps/web/.next && chown -R node:node /app

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]


# ---------- Docs ----------
ARG NODE_VERSION=24-alpine
FROM node:${NODE_VERSION} AS docs

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=6969

COPY --from=builder /app/apps/docs/.next/standalone ./
COPY --from=builder /app/apps/docs/.next/static ./apps/docs/.next/static

RUN mkdir -p apps/docs/.next && chown -R node:node /app

USER node
EXPOSE 6969
CMD ["node", "apps/docs/server.js"]


# ---------- API ----------
ARG NODE_VERSION=24-alpine
FROM node:${NODE_VERSION} AS api

WORKDIR /opt/api
ENV NODE_ENV=production

COPY --from=builder /opt/api-deploy/ ./

RUN chown -R node:node /opt/api

USER node
EXPOSE 8080
CMD ["node", "dist/index.mjs"]


# ---------- 三合一 ----------
ARG NODE_VERSION=24-alpine
FROM node:${NODE_VERSION} AS all

WORKDIR /
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    WEB_PORT=3000 \
    DOCS_PORT=6969

COPY --from=builder /app/apps/web/.next/standalone /services/web
COPY --from=builder /app/apps/web/.next/static /services/web/apps/web/.next/static
COPY --from=builder /app/apps/web/public /services/web/apps/web/public
COPY --from=builder /app/apps/web/content /services/web/content

COPY --from=builder /app/apps/docs/.next/standalone /services/docs
COPY --from=builder /app/apps/docs/.next/static /services/docs/apps/docs/.next/static

COPY --from=builder /opt/api-deploy/ /services/api

COPY docker/start-all.sh /usr/local/bin/start-all.sh
RUN chmod +x /usr/local/bin/start-all.sh \
    && chown -R node:node /services /usr/local/bin/start-all.sh

USER node
EXPOSE 3000 6969 8080
CMD ["/usr/local/bin/start-all.sh"]
