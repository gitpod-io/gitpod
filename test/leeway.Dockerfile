# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:575e8496bd9e839506cc5dca5a99cc2eebac714aa96032c24bb08516f7d78f63

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache \
    ca-certificates \
    coreutils \
    curl \
    jq

# deps for tests to run
RUN curl -fsSL "https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl" -o /usr/bin/kubectl \
  && chmod +x /usr/bin/kubectl

COPY test--app/bin /tests
ENV PATH=$PATH:/tests
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT [ "/entrypoint.sh" ]
