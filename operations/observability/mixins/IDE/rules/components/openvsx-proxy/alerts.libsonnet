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
            alert: 'GitpodOpenVsxProxyServesFromCache',
            labels: {
              severity: 'warning',
            },
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/observability/blob/main/runbooks/GitpodOpenVsxProxyServesFromCache.md',
              summary: 'OpenVSX serves from backup cache.',
              description: 'In the past 10 minutes, the OpenVSX proxy served more than 10 % of all requests from our cache most likely because the OpenVSX registry was not reachable.',
            },
            expr: |||
              (sum(rate(gitpod_openvsx_proxy_backup_cache_serve_total[10m])) / sum(rate(gitpod_openvsx_proxy_duration_overall_seconds_count[10m])) > 0.1
            |||,
          },
          {
            alert: 'GitpodOpenVsxProxyConnectionErrors',
            labels: {
              severity: 'warning',
            },
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/observability/blob/main/runbooks/GitpodOpenVsxProxyConnectionErrors.md',
              summary: 'OpenVSX proxy has connection errors.',
              description: 'In the past 10 minutes, more than 10 % of the requests to the OpenVSX proxy had connectivity errors.',
            },
            expr: |||
              sum(rate(gitpod_openvsx_proxy_requests_total{status="error"}[10m])) / sum(rate(gitpod_openvsx_proxy_requests_total[10m])) > 0.1
            |||,
          },
        ],
      },
    ],
  },
}
