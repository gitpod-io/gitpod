# Copyright (c) 2023 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:7574456f268bc839ac78828865087c04a4297ca226b0eb5d051d4222e7690081

WORKDIR /app
COPY components-local-app--app-with-manifest/bin/* ./

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
CMD ["/bin/sh", "-c", "cp /app/* /out"]
