# Garage images are FROM scratch (single static binary, Nix-built) — no shell.
# We need /bin/sh for start-garage.sh (layout assignment via CLI) and curl
# for the healthcheck. Copy the binary into Alpine to get both.
FROM dxflrs/garage:v2.2.0 AS garage
FROM alpine:3.21
RUN apk add --no-cache curl
COPY --from=garage /garage /garage
