# Linux equivalent of README "Run locally" prerequisites: Node.js 24, pnpm 11, PostgreSQL 18.
# Do not COPY the repo; Cursor checks out source after the image is built.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    gnupg \
    lsb-release \
    sudo \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && npm install -g pnpm@11.3.0 \
  && rm -rf /var/lib/apt/lists/*

ENV PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

RUN install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    postgresql-18 \
    postgresql-contrib-18 \
    postgresql-18-pgvector \
    postgresql-client-18 \
  && rm -rf /var/lib/apt/lists/*

# Passwordless local TCP, matching apps/company-os/.env.example.
RUN printf '%s\n' \
    'local   all             postgres                                peer' \
    'local   all             all                                     peer' \
    'host    all             all             127.0.0.1/32            trust' \
    'host    all             all             ::1/128                 trust' \
    > /etc/postgresql/18/main/pg_hba.conf

RUN printf 'ubuntu ALL=(ALL) NOPASSWD:ALL\n' > /etc/sudoers.d/ubuntu \
  && chmod 0440 /etc/sudoers.d/ubuntu

# CREATEDB is required for pnpm db:reset and database tests.
RUN pg_ctlcluster 18 main start \
  && su - postgres -c "createuser -s ubuntu" \
  && pg_ctlcluster 18 main stop

# Keep image Node 24 ahead of any injected Node 22 shim.
RUN printf 'export PATH="/usr/bin:/usr/local/bin:$PATH"\n' > /etc/profile.d/node-precedence.sh

USER ubuntu
WORKDIR /home/ubuntu
