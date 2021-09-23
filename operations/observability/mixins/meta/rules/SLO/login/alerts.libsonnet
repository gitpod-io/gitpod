/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  prometheusAlerts+:: {
    groups+: [
      {
        name: 'gitpod-login-slo-alerts',
        rules: [
          // Please read this entire page: https://sre.google/workbook/alerting-on-slos/
          // We are alerting on strategy #6
          {
            alert: 'GitpodLoginErrorBudgetBurn',
            labels: {
              severity: 'critical',
            },
            annotations: {
              runbook_url: 'https://github.com/gitpod-com/observability/blob/main/runbooks/GitpodLoginErrorBudgetBurn.md',
              summary: 'Error budget is being burn too quickly.',
              description: 'Error budget is being burn too quickly. At this rate, the whole monthly budget will be burnt in less than 2 days.',
            },
            expr: |||
              (
                gitpod_server_login_requests_total:1h_failure_ratio > (14.4 * (1 - gitpod_server_login_requests_total:slo_target))
                and
                gitpod_server_login_requests_total:5m_failure_ratio > (14.4 * (1 - gitpod_server_login_requests_total:slo_target))
              )
              or
              (
                gitpod_server_login_requests_total:6h_failure_ratio > (6 * (1 - gitpod_server_login_requests_total:slo_target))
                and
                gitpod_server_login_requests_total:30m_failure_ratio > (6 * (1 - gitpod_server_login_requests_total:slo_target))
              )
            |||,
          },
          {
            alert: 'GitpodLoginErrorBudgetBurn',
            labels: {
              severity: 'warning',
            },
            annotations: {
              runbook_url: 'https://github.com/gitpod-com/observability/blob/main/runbooks/GitpodLoginErrorBudgetBurn.md',
              summary: 'Error budget is being burn quickly.',
              description: 'Error budget is being burn quickly. At this rate, the whole monthly budget will be burnt in less than 10 days.',
            },
            expr: |||
              (
                gitpod_server_login_requests_total:1d_failure_ratio > (3 * (1 - gitpod_server_login_requests_total:slo_target))
                and
                gitpod_server_login_requests_total:2h_failure_ratio > (3 * (1 - gitpod_server_login_requests_total:slo_target))
              )
              or
              (
                gitpod_server_login_requests_total:3d_failure_ratio > (1 * (1 - gitpod_server_login_requests_total:slo_target))
                and
                gitpod_server_login_requests_total:6h_failure_ratio > (1 * (1 - gitpod_server_login_requests_total:slo_target))
              )
            |||,
          },
        ],
      },
    ],
  },
}
