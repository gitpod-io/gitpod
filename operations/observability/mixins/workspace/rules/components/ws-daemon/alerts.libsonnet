/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  prometheusAlerts+:: {
    groups+: [
      {
        name: 'gitpod-component-ws-daemon-alerts',
        rules: [
          {
            alert: 'GitpodWsDaemonCrashLooping',
            labels: {
              severity: 'warning',
            },
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/GitpodWsDaemonCrashLooping.md',
              summary: 'Ws-daemon is crashlooping.',
              description: 'Pod {{ $labels.namespace }}/{{ $labels.pod }} ({{ $labels.container }}) is restarting {{ printf "%.2f" $value }} times / 10 minutes.',
            },
            expr: |||
              increase(kube_pod_container_status_restarts_total{container="ws-daemon"}[10m]) > 0
            |||,
          },
          {
            alert: 'BackupFailureBecauseOfGitpodWsDaemonCrash',
            labels: {
              severity: 'critical',
            },
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/GitpodWsDaemonCrashLooping.md',
              summary: 'Increase the number of backup failure because of ws-daemon is crashlooping.',
              description: 'Pod {{ $labels.namespace }}/{{ $labels.pod }} ({{ $labels.container }}) is restarting {{ printf "%.2f" $value }} times / 10 minutes.',
            },
            expr: |||
              sum(increase(kube_pod_container_status_restarts_total{container="ws-daemon"}[10m])) > 0 AND sum(increase(gitpod_ws_manager_workspace_backups_failure_total{type="REGULAR"}[10m])) > 0
            |||,
          },
          {
            alert: 'GitpodWsDaemonExcessiveGC',
            labels: {
              severity: 'warning',
            },
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/GitpodWsDaemonExcessiveGC.md',
              summary: 'Ws-daemon is doing excessive garbage collection.',
              description: 'Ws-daemon has excessive garbage collection time. Collecting garbage for more than 1 second.',
            },
            expr: |||
              go_gc_duration_seconds{job="ws-daemon", quantile="1"} > 1
            |||,
          },
        ],
      },
    ],
  },
}
