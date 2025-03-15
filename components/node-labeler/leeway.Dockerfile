# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:fb9a7aedf73e6eb6c74206e61bcf60298436f4f7ab263d9cf61795097437221f

COPY components-node-labeler--app/node-labeler /app/node-labeler

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
ENTRYPOINT [ "/app/node-labeler" ]
CMD [ "-v", "help" ]
