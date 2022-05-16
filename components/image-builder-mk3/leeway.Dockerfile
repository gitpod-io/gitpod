# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM gitpod/workspace-full:latest

COPY components-image-builder-mk3--app/image-builder /app/
RUN sudo chmod +x /app/image-builder

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}

# ENTRYPOINT [ "dlv" ]
ENTRYPOINT [ "/app/image-builder" ]
CMD [ "-v", "help" ]
