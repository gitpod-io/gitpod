/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  prometheusAlerts+:: {
    groups+: [
      {
        name: 'gitpod-component-meta-db-sync-alerts',
        rules: [
          {
            alert: 'DBSyncCrashLooping',
            expr: 'sum(increase(kube_pod_container_status_restarts_total{container=~"db-sync.*"}[30m])) > 5',
            'for': '30m',
            labels: {
              severity: 'critical',
            },
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/DBSyncCrashLooping.md',
              summary: 'DB Sync is crashlooping and has restarted more than 5 times in the last 30 minutes',
              description: 'DB Sync ensures US and EU databases are in sync. It has been crash-looping which indicates it is not able to synchronize DBs. Prolonged failure will lead to data out sync.',
            },
          },
        ],
      },
    ],
  },
}
