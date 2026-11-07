# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git make gcc musl-dev libpcap-dev

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the scanner binary
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o network-scanner ./cmd/scanner

# Runtime stage
FROM alpine:3.19

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache libpcap ca-certificates tzdata

# Copy binary from builder
COPY --from=builder /app/network-scanner .

# Create non-root user
RUN adduser -D -u 1000 scanner && chown -R scanner:scanner /app
USER scanner

EXPOSE 7331 7332

ENTRYPOINT ["./network-scanner"]