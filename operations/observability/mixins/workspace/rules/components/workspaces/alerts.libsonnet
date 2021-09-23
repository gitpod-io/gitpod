/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  prometheusAlerts+:: {
    groups+: [
      {
        name: 'gitpod-component-workspace-alerts',
        rules: [
          {
            alert: 'GitpodWorkspaceStuckOnStarting',
            labels: {
              severity: 'critical',
            },
            'for': '1h',
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/observability/blob/main/runbooks/GitpodWorkspaceStuckOnStarting.md',
              summary: '5 or more workspaces are stuck on starting',
              description: '{{ printf "%.2f" $value }} regular workspaces are stuck on starting for more than 1 hour. Current status: "{{ $labels.reason }}"',
            },
            expr: |||
              count(
                kube_pod_container_status_waiting_reason * on(pod) group_left kube_pod_labels{component="workspace", workspace_type="regular"}
              ) by (reason) > 5
            |||,
          },
          {
            alert: 'GitpodWorkspaceStuckOnStopping',
            labels: {
              severity: 'critical',
            },
            'for': '1h',
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/observability/blob/main/runbooks/GitpodWorkspaceStuckOnStopping.md',
              summary: '5 or more workspaces are stuck on stopping',
              description: '{{ printf "%.2f" $value }} {{ $labels.workspace_type }} workspaces are stuck on stopping for more than 1 hour.',
            },
            expr: |||
              sum(
                gitpod_ws_manager_workspace_phase_total{type="REGULAR", phase="STOPPING"}
              ) without(phase) > 5
            |||,
          },
        ],
      },
    ],
  },
}
