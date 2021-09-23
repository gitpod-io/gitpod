/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  prometheusRules+:: {
    groups+: [
      {
        name: 'gitpod-login-slo-records',
        rules: [
          {
            record: 'gitpod_server_login_requests_total:5m_failure_ratio',
            expr: |||
              sum(rate(gitpod_server_login_requests_total{status="failed"}[5m]))
              /
              sum(rate(gitpod_server_login_requests_total[5m]))
            |||,
          },
          {
            record: 'gitpod_server_login_requests_total:30m_failure_ratio',
            expr: |||
              sum(rate(gitpod_server_login_requests_total{status="failed"}[30m]))
              /
              sum(rate(gitpod_server_login_requests_total[30m]))
            |||,
          },
          {
            record: 'gitpod_server_login_requests_total:1h_failure_ratio',
            expr: |||
              sum(rate(gitpod_server_login_requests_total{status="failed"}[1h]))
              /
              sum(rate(gitpod_server_login_requests_total[1h]))
            |||,
          },
          {
            record: 'gitpod_server_login_requests_total:2h_failure_ratio',
            expr: |||
              sum(rate(gitpod_server_login_requests_total{status="failed"}[2h]))
              /
              sum(rate(gitpod_server_login_requests_total[2h]))
            |||,
          },
          {
            record: 'gitpod_server_login_requests_total:6h_failure_ratio',
            expr: |||
              sum(rate(gitpod_server_login_requests_total{status="failed"}[6h]))
              /
              sum(rate(gitpod_server_login_requests_total[6h]))
            |||,
          },
          {
            record: 'gitpod_server_login_requests_total:1d_failure_ratio',
            expr: |||
              sum(rate(gitpod_server_login_requests_total{status="failed"}[1d]))
              /
              sum(rate(gitpod_server_login_requests_total[1d]))
            |||,
          },
          {
            record: 'gitpod_server_login_requests_total:3d_failure_ratio',
            expr: |||
              sum(rate(gitpod_server_login_requests_total{status="failed"}[3d]))
              /
              sum(rate(gitpod_server_login_requests_total[3d]))
            |||,
          },
          {
            record: 'gitpod_server_login_requests_total:30d_failure_ratio',
            expr: |||
              sum(rate(gitpod_server_login_requests_total{status="failed"}[30d]))
              /
              sum(rate(gitpod_server_login_requests_total[30d]))
            |||,
          },
          {
            record: 'gitpod_server_login_requests_total:slo_target',
            expr: '0.95',
          },
          {
            record: 'gitpod_server_login_requests_total:error_budget_remaining',
            expr: 'gitpod_server_login_requests_total:monthly_availability - gitpod_server_login_requests_total:slo_target',
          },
          {
            record: 'gitpod_server_login_requests_total:monthly_availability',
            expr: '1 - gitpod_server_login_requests_total:30d_failure_ratio',
          },
        ],
      },
    ],
  },
}
