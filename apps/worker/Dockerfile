# Annotated worker — Fastify + ffmpeg + yt-dlp, deployed to Fly.io.
# Build context is the REPO ROOT (monorepo): deploy with
#   fly deploy --config apps/worker/fly.toml --dockerfile apps/worker/Dockerfile .
FROM node:22-slim

# ffmpeg for clip/transcode; the worker spawns a bare `yt-dlp` (youtube-clipper.ts),
# so install it on PATH. Use the arch-independent python zipapp (works on amd64
# and arm64 Fly machines) rather than the amd64-only standalone binary.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates python3 curl \
  && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
       -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

# Whole monorepo (node_modules/build excluded via .dockerignore). Installing with
# `--filter worker...` pulls ONLY the worker + @annotated/shared and their deps,
# so the web/extension postinstalls (HeroUI CDN, Plasmo) never run here. This
# also triggers yt-dlp-exec's postinstall to fetch the Linux yt-dlp binary.
COPY . .
RUN pnpm install --frozen-lockfile --filter worker...

ENV PORT=8080
EXPOSE 8080

WORKDIR /app/apps/worker
# Run via tsx (as in dev) — @annotated/shared ships TypeScript with no JS build
# (it's a bundler-resolved package), so tsx transpiles it + the worker at boot.
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
