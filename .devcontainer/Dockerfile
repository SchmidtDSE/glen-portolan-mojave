# Dev environment only: the app itself is static files and needs none of this.
# The repository is mounted at /workspace; the pixi environment is built into
# the image under /opt/pixi-envs so it survives the mount.
FROM ghcr.io/prefix-dev/pixi:0.83.0-bookworm-slim

ENV PIXI_PROJECT_MANIFEST=/workspace/.devcontainer/pixi.toml
RUN pixi config set --global detached-environments /opt/pixi-envs

COPY pixi.toml pixi.lock /workspace/.devcontainer/
RUN pixi install --locked

WORKDIR /workspace
EXPOSE 8000
CMD ["pixi", "run", "serve"]
