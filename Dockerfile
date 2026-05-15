# Stage 1: Build Svelte frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Go binary (embeds frontend)
FROM golang:1.24-alpine AS go-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend-builder /internal/embed/dist ./internal/embed/dist
RUN CGO_ENABLED=0 GOOS=linux go build -a -ldflags='-s -w' -o medlog ./cmd/medlog

# Stage 3: Minimal runtime
FROM gcr.io/distroless/static:nonroot
COPY --from=go-builder /app/medlog /medlog
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["/medlog", "healthcheck"]
ENTRYPOINT ["/medlog"]
