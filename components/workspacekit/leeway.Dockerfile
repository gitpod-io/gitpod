# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:3.15 as download
ENV SLIRP4NETNS_VERSION=v1.1.12
WORKDIR /download
RUN wget https://github.com/rootless-containers/slirp4netns/releases/download/${SLIRP4NETNS_VERSION}/slirp4netns-$(uname -m) -O slirp4netns && chmod 755 slirp4netns

FROM scratch

COPY components-workspacekit--app/workspacekit \
     components-workspacekit--fuse-overlayfs/fuse-overlayfs \
     /.supervisor/
COPY --from=download /download/slirp4netns /.supervisor/

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}

