/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  prometheusAlerts+:: {
    groups+: [
      {
        name: 'gitpod-component-node-alerts',
        rules: [
          {
            alert: 'GitpodNodeRunningOutOfEphemeralStorage',
            labels: {
              severity: 'critical',
            },
            'for': '10m',
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/GitpodNodeRunningOutOfEphemeralStorage.md',
              summary: 'Node almost out of ephemeral storage',
              description: 'Node {{ $labels.node }} is reporting {{ printf "%.2f" $value }}% ephemeral storage left under {{ $labels.mountpoint }}.',
            },
            expr:
              |||
                (
                  min (
                    node_filesystem_avail_bytes{mountpoint=~"/var/lib/(kubelet|containerd)"} / node_filesystem_size_bytes{mountpoint=~"/var/lib/(kubelet|containerd)"}
                  ) by (node, mountpoint) * 100
                ) - 10 < 5
              |||,
          },
        ],
      },
    ],
  },
}
