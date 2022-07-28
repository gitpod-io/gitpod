/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  prometheusAlerts+:: {
    groups+: [
      {
        name: 'gitpod-component-openvsx-proxy-alerts',
        rules: [
          {
            alert: 'GitpodOpenVSXRegistryDown',
            labels: {
              severity: 'critical',
            },
            'for': '20m',
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/GitpodOpenVsxRegistryDown.md',
              summary: 'Open-VSX registry is possibly down',
              description: 'Open-VSX registry is possibly down. We cannot pull VSCode extensions we don\'t have in our caches',
            },
            expr:
              |||
                sum(rate(gitpod_openvsx_proxy_requests_total{status=~"5..|error"}[5m])) / sum(rate(gitpod_openvsx_proxy_requests_total[5m])) > 0.01
              |||,
          },
        ],
      },
    ],
  },
}
