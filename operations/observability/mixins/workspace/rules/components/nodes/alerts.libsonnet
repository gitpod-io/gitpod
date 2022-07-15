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
              team: 'workspace'
            },
            'for': '10m',
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/GitpodWorkspaceNodeHighNormalizedLoadAverage.md',
              summary: "Workspace node's normalized load average is higher than 10 for more than 10 minutes. Check for abuse.",
              description: 'Node {{ $labels.node }} is reporting {{ printf "%.2f" $value }}% normalized load average. Normalized load average is current load average divided by number of CPU cores of the node.',
            },
            expr: 'nodepool:node_load1:normalized{nodepool=~".*workspace.*"} > 10',
          },
          {
            alert: 'AutoscalerAddsNodesTooFast',
            labels: {
              severity: 'critical',
            },
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/AutoscalerAddsNodesTooFast.md',
              summary: "Autoscaler is adding new nodes rapidly",
              description: 'Autoscaler in cluster {{ $labels.cluster }} is rapidly adding new nodes.',
            },
            expr: '((sum(kube_node_labels{nodepool=~"workspace-.*"}) by (cluster)) - (sum(kube_node_labels{nodepool=~"workspace-.*"} offset 10m) by (cluster))) > 15',
          },
          {
            alert: 'AutoscaleFailure',
            labels: {
              severity: 'critical',
            },
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/AutoscaleFailure.md',
              summary: "Automatic scale-up failed for some reason.",
              description: 'Automatic scale-up failed for some reason.',
            },
            expr: |||
              increase(cluster_autoscaler_failed_scale_ups_total[1m]) != 0
            |||,
          },
        ],
      },
    ],
  },
}
