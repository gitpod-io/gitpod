/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  prometheusAlerts+:: {
    groups+: [
      {
        name: 'gitpod-component-meta-messagebus-alerts',
        rules: [
          {
            alert: 'GitpodMetaMessagebusTotalQueues',
            labels: {
              severity: 'critical',
            },
            'for': '2m',
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/GitpodMetaMessagebusTotalQueues.md',
              summary: 'A messagebus has too many queues in total.',
              description: 'messagebus {{ $labels.pod }} is reporting {{ printf "%.2f" $value }} queues in total.',
            },
            expr: 'sum by (instance) (rabbitmq_queues) > 10000',
          },
        ],
      },
    ],
  },
}
