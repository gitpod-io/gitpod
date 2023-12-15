# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:30966d652dce607ed88ce7532eeb0d95344e48b36a1ec3b9dc57c469e9885275

COPY components-node-labeler--app/node-labeler /app/node-labeler

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
ENTRYPOINT [ "/app/node-labeler" ]
CMD [ "-v", "help" ]
