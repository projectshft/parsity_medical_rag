# Bakes our config into the LiteLLM image so it deploys as a single artifact
# (Fly/Railway don't do local bind-mounts). Budgets/keys persist in the
# DATABASE_URL Postgres that the platform attaches.
FROM ghcr.io/berriai/litellm:main-stable

COPY litellm-config.yaml /app/config.yaml

# LiteLLM's entrypoint takes these args; PORT is provided by the platform.
CMD ["--config", "/app/config.yaml", "--port", "4000"]
