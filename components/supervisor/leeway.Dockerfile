# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM alpine:3.19 as docker_cli_builder

RUN apk add wget tar

ARG DOCKER_VERSION

RUN mkdir /gp-docker \
     && cd /gp-docker \
     && wget https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_VERSION}.tgz \
     && tar -zxvf docker-${DOCKER_VERSION}.tgz docker/docker

FROM scratch

# BEWARE: This must be the first layer in the image, s.t. that blobserve
#         can serve the IDE host. Even moving WORKDIR before this line
#         would break things.
COPY components-supervisor-frontend--app/node_modules/@gitpod/supervisor-frontend/dist/ /.supervisor/frontend/

WORKDIR "/.supervisor"
COPY components-supervisor--app/supervisor \
     supervisor-config.json \
     browser.sh \
     components-gitpod-cli--app/gitpod-cli \
     ./

WORKDIR "/.supervisor/ssh"
COPY components-supervisor-openssh--app/usr/sbin/sshd .
COPY components-supervisor-openssh--app/usr/bin/ssh-keygen .
COPY components-supervisor-openssh--app/usr/libexec/sshd-session .

COPY --from=docker_cli_builder /gp-docker/docker/docker /.supervisor/gitpod-docker-cli

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}

ENTRYPOINT ["/.supervisor/supervisor"]
