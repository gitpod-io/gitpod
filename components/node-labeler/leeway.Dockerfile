# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:ef6dd240997674c8a940dd9ab565dd3e8700b8f7a8e7b743ed16b925d81a70ef

COPY components-node-labeler--app/node-labeler /app/node-labeler

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
ENTRYPOINT [ "/app/node-labeler" ]
CMD [ "-v", "help" ]
