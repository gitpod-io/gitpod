# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

# TODO(aledbf): fix werft job build issue
# FROM OPENSSH_IMAGE AS openssh
FROM aledbf/static-openssh:0.50 AS openssh

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

WORKDIR "/.supervisor/ssh"
COPY --from=openssh /usr/sbin/sshd .
COPY --from=openssh /usr/bin/ssh-keygen .

ENTRYPOINT ["/.supervisor/supervisor"]
