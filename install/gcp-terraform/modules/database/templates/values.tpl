# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

db:
  host: "${host}"
  password: "${password}"

components:
  db:
    autoMigrate: true
    gcloudSqlProxy:
      enabled: true
      instance: ${instance}
      credentials: ${credentials}
    serviceType: ClusterIP

mysql:
  enabled: false
