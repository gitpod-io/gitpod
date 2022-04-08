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
            'for': '20m',
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/GitpodWorkspaceStuckOnStarting.md',
              summary: '5 or more workspaces are stuck on starting',
              description: '{{ printf "%.2f" $value }} regular workspaces are stuck on starting for more than 20 minutes. Current status: "{{ $labels.reason }}"',
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
            'for': '20m',
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/GitpodWorkspaceStuckOnStopping.md',
              summary: '5 or more workspaces are stuck on stopping',
              description: '{{ printf "%.2f" $value }} {{ $labels.workspace_type }} workspaces are stuck on stopping for more than 20 minutes.',
            },
            expr: |||
              sum(
                gitpod_ws_manager_workspace_phase_total{type="REGULAR", phase="STOPPING"}
              ) without(phase) > 5
            |||,
          },
          {
            alert: 'GitpodWorkspaceStatusUpdatesCeased',
            labels: {
              severity: 'warning',
            },
            'for': '10m',
            annotations: {
              runbook_url: 'none',
              summary: 'meta has not seen a workspace update in the last 10 minutes despite starting workspaces',
              description: 'meta has not seen a workspace update in the last 10 minutes despite starting workspaces',
            },
            expr: |||
              sum(rate(gitpod_ws_manager_bridge_status_updates_total[1m])) == 0 AND sum(rate(grpc_client_handled_total{grpc_method="StartWorkspace", grpc_service="wsman.WorkspaceManager"}[1m])) != 0
            |||,
          },
          {
            alert: 'GitpodWorkspaceTooManyRegularNotActive',
            labels: {
              severity: 'critical',
            },
            'for': '15m',
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/GitpodWorkspaceTooManyRegularNotActive.md',
              summary: 'too many running but inactive workspaces',
              description: 'too many running but inactive workspaces',
            },
            expr: |||
              gitpod_workspace_regular_not_active_percentage > 0.15 AND sum(gitpod_ws_manager_workspace_activity_total) > 100
            |||,
          },
          {
            alert: 'GitpodWorkspacesNotStarting',
            labels: {
              severity: 'critical',
            },
            'for': '10m',
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/GitpodWorkspaceNotStarting.md',
              summary: 'workspaces are not starting',
              description: 'inactive regular workspaces exists but workspaces are not being started',
            },
            expr: |||
              avg_over_time(gitpod_workspace_regular_not_active_percentage[1m]) > 0
              AND
              rate(gitpod_ws_manager_workspace_startup_seconds_sum{type="REGULAR"}[1m]) == 0
            |||,
          },
        ],
      },
    ],
  },
}
