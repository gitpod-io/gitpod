# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM scratch

COPY components-workspacekit--app/workspacekit \
     /.supervisor/

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
