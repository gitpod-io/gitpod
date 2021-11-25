# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:3.15 as download
ENV SLIRP4NETNS_VERSION=v1.1.12
WORKDIR /download
RUN wget https://github.com/rootless-containers/slirp4netns/releases/download/${SLIRP4NETNS_VERSION}/slirp4netns-x86_64 -O slirp4netns && chmod 755 slirp4netns

FROM scratch

# BEWARE: This must be the first layer in the image, s.t. that blobserve
#         can serve the IDE host. Even moving WORKDIR before this line
#         would break things.
COPY components-supervisor-frontend--app/node_modules/@gitpod/supervisor-frontend/dist/ /.supervisor/frontend/

WORKDIR "/.supervisor"
COPY components-supervisor--app/supervisor \
     supervisor-config.json \
     components-workspacekit--app/workspacekit \
     components-workspacekit--fuse-overlayfs/fuse-overlayfs \
     components-gitpod-cli--app/gitpod-cli \
     ./
COPY --from=download /download/slirp4netns .

WORKDIR "/.supervisor/ssh"
COPY components-supervisor-openssh--app/usr/sbin/sshd .
COPY components-supervisor-openssh--app/usr/bin/ssh-keygen .

ENTRYPOINT ["/.supervisor/supervisor"]
