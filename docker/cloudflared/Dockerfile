# Tunnel service needs a shell to generate config; official cloudflare/cloudflared image is shell-less.
# Build context is this directory only to avoid Windows BuildKit "changes out of order" errors.
FROM alpine:3.19
RUN apk add --no-cache curl ca-certificates
ARG CLOUDFLARED_VERSION=2024.11.0
ARG TARGETARCH
RUN case "$TARGETARCH" in \
    amd64)  CF_ARCH=amd64 ;; \
    arm64)  CF_ARCH=arm64 ;; \
    *)      CF_ARCH=amd64 ;; \
    esac && \
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-${CF_ARCH}" -o /usr/local/bin/cloudflared && \
  chmod +x /usr/local/bin/cloudflared
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r//' /entrypoint.sh && chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
