# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

db:
  host: "${host}"
  password: "${password}"
  port: 3306

components:
  db:
    name: db
    autoMigrate: true
    gcloudSqlProxy:
      enabled: true
      instance: ${instance}
      credentials: ${credentials}
    serviceType: ClusterIP

mysql:
  enabled: false
