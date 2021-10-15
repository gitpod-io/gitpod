/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  prometheusRules+:: {
    groups+: [
      {
        name: 'gitpod-workspace-component-node-records',
        rules: [
          {
            record: 'nodepool:node_load1:normalized',
            expr:
              |||
                node_load1 * on(node) group_left(nodepool) kube_node_labels
                /
                count without (cpu) (
                  count without (mode) (
                    node_cpu_seconds_total * on(node) group_left(nodepool) kube_node_labels
                  )
                )
              |||,
          },
        ],
      },
    ],
  },
}
