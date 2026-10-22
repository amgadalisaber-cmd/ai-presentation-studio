# Production image with Node 22, Chromium (via Playwright base image) and the built app.
FROM mcr.microsoft.com/playwright:v1.58.2-noble AS base
WORKDIR /app
ENV NODE_ENV=production PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM base AS runner
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json /app/next.config.ts /app/tsconfig.json ./
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
RUN mkdir -p /app/storage && chown -R pwuser:pwuser /app
USER pwuser
ENV PORT=3000 STORAGE_DIR=/app/storage
EXPOSE 3000
# Creates/updates tables and seeds built-in styles, then starts the server.
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx prisma/seed.ts && npm start"]
