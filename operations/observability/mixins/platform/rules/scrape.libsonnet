/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

{
  prometheusAlerts+:: {
    groups+: [
      {
        name: 'prometheus-scraping-rules',
        rules: [
          {
            alert: 'TargetDownOrFailedScrape',
            labels: {
              severity: 'warning',
              team: 'platform',
            },
            'for': '10m',
            annotations: {
              summary: 'Prometheus failed to scrape {{ $labels.job }}',
              description: 'Prometheus couldn\'t scrape {{ printf "%.4g" $value }}% of the {{ $labels.job }} targets. Components could be unnavailable or we have some scraping misconfiguration.',
            },
            expr: '100 * (count(up{container!="workspace"} == 0) BY (job) / count(up{container!="workspace"}) BY (job)) > 10',
          },
        ],
      },
    ],
  },
}
