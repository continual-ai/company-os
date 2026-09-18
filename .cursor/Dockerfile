# Linux equivalent of README "Run locally" prerequisites: Node.js 24, pnpm 11,
# and Docker Engine so `docker compose up -d` provides PostgreSQL 18.
# Do not COPY the repo; Cursor checks out source after the image is built.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    gnupg \
    sudo \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && npm install -g pnpm@11.3.0 \
  && rm -rf /var/lib/apt/lists/*

ENV PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Docker Engine is unpinned: pinned patch versions leave the apt repo and break
# later builds. Nested Cloud VMs cannot use overlay2 or nftables.
RUN install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc \
  && chmod a+r /etc/apt/keyrings/docker.asc \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo ${UBUNTU_CODENAME:-$VERSION_CODENAME}) stable" \
    > /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin \
    fuse-overlayfs \
    iptables \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /etc/docker \
  && printf '%s\n' '{' '  "storage-driver": "fuse-overlayfs"' '}' > /etc/docker/daemon.json \
  && update-alternatives --set iptables /usr/sbin/iptables-legacy \
  && update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy

RUN printf 'ubuntu ALL=(ALL) NOPASSWD:ALL\n' > /etc/sudoers.d/ubuntu \
  && chmod 0440 /etc/sudoers.d/ubuntu \
  && usermod -aG docker ubuntu

# Keep image Node 24 ahead of any injected Node 22 shim.
RUN printf 'export PATH="/usr/bin:/usr/local/bin:$PATH"\n' > /etc/profile.d/node-precedence.sh

USER ubuntu
WORKDIR /home/ubuntu
