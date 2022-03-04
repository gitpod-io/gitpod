/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  prometheusRules+:: {
    groups+: [
      {
        name: 'gitpod-workspace-regular-not-active-records',
        rules: [
          {
            record: 'gitpod_workspace_regular_not_active_percentage',
            expr: |||
              sum(gitpod_ws_manager_workspace_activity_total{active="false"}) / sum(gitpod_ws_manager_workspace_activity_total)
            |||,
          },
        ],
      },
    ],
  },
}
