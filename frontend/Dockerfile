# ---- build ------------------------------------------------------------------
# The build stage compiles the application; nothing of it ships to production.
FROM node:20-alpine AS build

WORKDIR /app

# The dependencies are installed from the lockfile alone, so the layer is
# reused whenever only the sources change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The API is served by nginx under the same origin (the /api/ location of
# nginx/templates/default.conf.template). The bundle must ask for the
# relative path, never for "http://localhost:8000" - the browser of the
# member would then call its own machine and every call would fail.
ENV VITE_API_BASE_URL=/api/v1

# `npm run build` runs `tsc -b` first: a type error fails the image build
# instead of the deployment.
RUN npm run build

# ---- runtime ----------------------------------------------------------------
# The production image serves the compiled files with nginx. It never runs
# the Vite development server (OPS-001): the dev server is not a web server.
FROM nginx:1.27-alpine AS runtime

# The upstream of the API proxy (host:port); the container entrypoint
# substitutes it from the environment (see the template below).
ENV API_UPSTREAM=backend:8000

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/templates/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/snippets /etc/nginx/snippets

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
