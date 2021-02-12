# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

components:
  imageBuilder:
    # The image builder deploys a Docker-in-Docker-daemon. By default that Docker daemon works in an empty-dir on the node.
    # Depending on the types of node you operate that may cause image builds to fail or not perform well. We recommend you give the Docker daemon
    # fast storage on the node, e.g. an SSD.
    hostDindData: /mnt/disks/ssd0/docker
  wsSync:
    # Workspace data is stored on the nodes. This setting configures where on the ndoe the workspace data lives.
    # The faster this location is (in terms of IO) the faster workspaces will initialize.
    hostWorkspaceArea: /mnt/disks/ssd0/workspaces
