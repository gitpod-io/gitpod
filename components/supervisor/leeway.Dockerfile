# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM scratch

# BEWARE: This must be the first layer in the image, s.t. that blobserve
#         can serve the IDE host. Even moving WORKDIR before this line
#         would break things.
COPY components-supervisor-frontend--app/node_modules/@gitpod/supervisor-frontend/dist/ /.supervisor/frontend/

WORKDIR "/.supervisor"
COPY components-supervisor--app/supervisor /.supervisor/supervisor
COPY supervisor-config.json /.supervisor/supervisor-config.json
COPY components-workspacekit--app/workspacekit /.supervisor/workspacekit
COPY components-workspacekit--fuse-overlayfs/fuse-overlayfs /.supervisor/fuse-overlayfs

ENTRYPOINT ["/.supervisor/supervisor"]