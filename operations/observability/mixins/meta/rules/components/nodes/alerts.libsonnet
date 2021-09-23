/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  prometheusAlerts+:: {
    groups+: [
      {
        name: 'gitpod-component-meta-node-alerts',
        rules: [
          {
            alert: 'GitpodMetaNodeOOMKills',
            labels: {
              severity: 'warning',
            },
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/observability/blob/main/runbooks/GitpodMetaNodeOOMKills.md',
              summary: 'A meta node is reporting OOM kills.',
              description: 'Meta node {{ $labels.instance }} is reporting {{ printf "%.2f" $value }} Out Of Memory kills in the last 10 minutes.',
            },
            expr: 'increase(node_vmstat_oom_kill{instance=~".*meta.*"}[10m]) > 1',
          },
          {
            alert: 'GitpodMetaNodeCPUSaturation',
            labels: {
              severity: 'warning',
            },
            'for': '10m',
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/observability/blob/main/runbooks/GitpodMetaNodeCPUSaturation.md',
              summary: 'High CPU Saturation of a meta node.',
              description: 'Meta node {{ $labels.instance }} is reporting {{ printf "%.2f" $value }}% CPU usage for more than 10 minutes.',
            },
            expr: '(1 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle", instance=~".*meta.*"}[2m])))) * 100 > 75',
          },
        ],
      },
    ],
  },
}
