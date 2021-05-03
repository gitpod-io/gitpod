# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

components:
  imageBuilder:
    registryCerts: []
    registry:
      name: "gcr.io/${project}"
      secretName: ${secretName}

  workspace:
    pullSecret:
      secretName: ${secretName}

docker-registry:
  enabled: false
