/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  prometheusAlerts+:: {
    groups+: [
      {
        name: 'gitpod-component-ws-manager-alerts',
        rules: [
          {
            alert: 'GitpodWsManagerCrashLooping',
            labels: {
              severity: 'critical',
            },
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/observability/blob/main/runbooks/GitpodWsManagerCrashLooping.md',
              summary: 'Ws-manager is crashlooping.',
              description: 'Pod {{ $labels.namespace }}/{{ $labels.pod }} ({{ $labels.container }}) is restarting {{ printf "%.2f" $value }} times / 10 minutes.',
            },
            expr: |||
              increase(kube_pod_container_status_restarts_total{container="ws-manager"}[10m]) > 0
            |||,
          },
        ],
      },
    ],
  },
}
