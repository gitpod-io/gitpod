# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

components:
  imageBuilder:
    registryCerts: []
    registry:
      name: "eu.gcr.io/${project}"
      secretName: ${secretName}
#      path: secrets/registry-auth.json

  workspace:
    pullSecret:
      secretName: ${secretName}

docker-registry:
  enabled: false

gitpod_selfhosted:
  variants:
    customRegistry: true
