/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  prometheusAlerts+:: {
    groups+: [
      {
        name: 'gitpod-workspace-component-node-alerts',
        rules: [
          {
            alert: 'GitpodWorkspaceNodeHighNormalizedLoadAverage',
            labels: {
              severity: 'warning',
            },
            'for': '10m',
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/observability/blob/main/runbooks/GitpodWorkspaceNodeHighNormalizedLoadAverage.md',
              summary: "Workspace node's normalized load average is higher than 10 for more than 10 minutes.",
              description: 'Node {{ $labels.node }} is reporting {{ printf "%.2f" $value }}% normalized load average. Normalized load average is current load average divided by number of CPU cores of the node.',
            },
            expr: 'nodepool:node_load1:normalized{nodepool=~".*workspace.*"} > 10',
          },
        ],
      },
    ],
  },
}
