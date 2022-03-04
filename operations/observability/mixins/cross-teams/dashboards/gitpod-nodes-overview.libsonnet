/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

local grafana = import 'github.com/grafana/grafonnet-lib/grafonnet/grafana.libsonnet';
local dashboard = grafana.dashboard;
local row = grafana.row;
local prometheus = grafana.prometheus;
local template = grafana.template;
local graphPanel = grafana.graphPanel;
local heatmapPanel = grafana.heatmapPanel;
local tablePanel = grafana.tablePanel;
local statPanel = grafana.statPanel;
local _config = (import '../config.libsonnet')._config;

local datasourceTemplate = {
  current: {
    text: 'Prometheus',
    value: 'Prometheus',
  },
  hide: 0,
  label: null,
  name: 'datasource',
  options: [],
  query: 'prometheus',
  refresh: 1,
  regex: '',
  type: 'datasource',
};

local clusterTemplate =
  template.new(
    name='cluster',
    datasource='$datasource',
    query='label_values(up{job="node-exporter"}, %s)' % _config.clusterLabel,
    current='all',
    hide=if _config.showMultiCluster then '' else 'hide',
    refresh=2,
    includeAll=true,
    multi=true,
    sort=1
  );

local nodepoolTemplate =
  template.new(
    name='nodepool',
    datasource='$datasource',
    query='label_values(kube_node_labels{%s=~"$cluster"}, nodepool)' % _config.clusterLabel,
    current='all',
    refresh=2,
    includeAll=true,
    multi=true,
    sort=1
  );

local hiddenTimeStyle = {
  type: 'hidden',
  pattern: 'Time',
}
;

local hiddenNodepoolStyle = {
  type: 'hidden',
  pattern: 'nodepool',
}
;

local byteValueStyle = {
  unit: 'bytes',
  decimals: 1,
  pattern: 'Value',
  type: 'number',
}
;

local noneValueStyle = {
  unit: 'none',
  decimals: 1,
  pattern: 'Value',
  type: 'number',
}
;

local adminNodeDashboardRedirectStyle = {
  pattern: 'node',
  link: true,
  linkUrl: 'd/gitpod-admin-nodes/gitpod-admin-nodes?var-datasource=$datasource&var-cluster=$__cell_1&var-nodepool=$__cell_3&var-node=$__cell',
  linkTargetBlank: true,
}
;

local numberOfNodesStatsPanel =
  statPanel.new(
    '$cluster: # of nodes',
    description='Number of nodes in the cluster (nodepool filter applied)',
    datasource='$datasource',
    min=0,
    reducerFunction='lastNotNull',
    repeat='%s' % _config.clusterLabel
  )
  .addTarget(prometheus.target('count(kube_node_labels{%(clusterLabel)s="$cluster", nodepool=~"$nodepool"})' % _config))
;

local freeDiskClusterGraph =
  graphPanel.new(
    'Average free disk per cluster (/dev/sdb)',
    description='Average of free disk space in the /dev/sdb across all nodes of a cluster.',
    datasource='$datasource',
    span=12,
    format='bytes',
    stack=false,
    fill=1,
    fillGradient=5,
    min=0,
  )
  .addTarget(prometheus.target(
    |||
      avg(
        node_filesystem_avail_bytes{%(clusterLabel)s=~"$cluster", fstype!="shiftfs", device="/dev/sdb"}
        *
        on(node, %(clusterLabel)s) kube_node_labels{nodepool=~"$nodepool"}
      ) by (device, %(clusterLabel)s)
    ||| % _config, legendFormat='{{%(clusterLabel)s}}' % _config
  ))
;

local freeDiskHeatMap =
  heatmapPanel.new(
    title='Free disk space',
    description='Free disk space on /dev/sdb per node, distributed in buckets. Workspaces running on nodes in the lowest buckets will probably have issues.',
    datasource='$datasource',
    span=6,
    yAxis_format='bytes',
    dataFormat='timeseries',
    yAxis_min=0,
    yBucketBound='auto',
    hideZeroBuckets=true,
    highlightCards=true,
    color_mode='spectrum',
    color_colorScheme='interpolateGreens',
  )
  .addTarget(prometheus.target(
    |||
      node_filesystem_avail_bytes{%(clusterLabel)s=~"$cluster", fstype!="shiftfs", device="/dev/sdb"}
      *
      on(node, %(clusterLabel)s) kube_node_labels{nodepool=~"$nodepool"}
    ||| % _config, format='table'
  ))
;

local freeDiskTablePanel =
  tablePanel.new(
    title='Current nodes with least available disk',
    description=
    |||
      Top 10 nodes with least amount of free space on the /dev/sdb mountpoint. If the any nodes have less than 20GB, it's time to clean it up. (Don't worry we have an alert for it)

      If you'd like to see more details about resource consumption of a particular node, you can do so by clicking at the node name.
    |||,
    datasource='$datasource',
    span=6,
    styles=[adminNodeDashboardRedirectStyle, hiddenNodepoolStyle, hiddenTimeStyle, byteValueStyle { alias: 'Free disk' }]
  )
  .addTarget(prometheus.target(
    |||
      sort_desc(
        bottomk(10,
          sum(
            node_filesystem_avail_bytes{%(clusterLabel)s=~"$cluster", fstype!="shiftfs", device="/dev/sdb"}
            *
            on(node, %(clusterLabel)s) group_left(nodepool) kube_node_labels{nodepool=~"$nodepool"}
          ) by (node, nodepool, %(clusterLabel)s)
        )
      )
    ||| % _config, format='table', instant=true
  ))
;

local freeMemoryClusterGraph =
  graphPanel.new(
    'Average free memory per cluster',
    description='Average of free memory across all nodes of a cluster.',
    datasource='$datasource',
    span=12,
    format='bytes',
    stack=false,
    fill=1,
    fillGradient=5,
    min=0,
  )
  .addTarget(prometheus.target(
    |||
      avg(
        node_memory_MemAvailable_bytes{%(clusterLabel)s=~"$cluster"}
        *
        on(node, %(clusterLabel)s) kube_node_labels{nodepool=~"$nodepool"}
      ) by (%(clusterLabel)s)
    ||| % _config, legendFormat='{{%(clusterLabel)s}}' % _config
  ))
;

local freeMemoryTablePanel =
  tablePanel.new(
    title='Current nodes with least available memory',
    description=
    |||
      Top 10 nodes with least amount of free memory. Ideally, we should never have a node with free memory equals to 0. Pods will start to get OOM killed.

      If you'd like to see more details about resource consumption of a particular node, you can do so by clicking at the node name.
    |||,
    datasource='$datasource',
    span=6,
    styles=[adminNodeDashboardRedirectStyle, hiddenNodepoolStyle, hiddenTimeStyle, byteValueStyle { alias: 'Free Memory' }]
  )
  .addTarget(prometheus.target(
    |||
      sort_desc(
        bottomk(10,
          sum(
            node_memory_MemAvailable_bytes{%(clusterLabel)s=~"$cluster"}
            *
            on(node, %(clusterLabel)s) group_left(nodepool) kube_node_labels{nodepool=~"$nodepool"}
          ) by (node, nodepool, %(clusterLabel)s)
        )
      )
    ||| % _config, format='table', instant=true
  ))
;

local freeMemoryHeatMap =
  heatmapPanel.new(
    title='Free Memory',
    description='Free memory per node, distributed in buckets. Workspaces running on nodes in the lowest buckets are good candidates to get OOMed.',
    datasource='$datasource',
    span=6,
    yAxis_format='bytes',
    dataFormat='timeseries',
    yAxis_min=0,
    yBucketBound='auto',
    hideZeroBuckets=true,
    highlightCards=true,
    color_mode='spectrum',
    color_colorScheme='interpolateGreens',
  )
  .addTarget(prometheus.target(
    |||
      node_memory_MemAvailable_bytes{%(clusterLabel)s=~"$cluster"}
      *
      on(node, %(clusterLabel)s) kube_node_labels{nodepool=~"$nodepool"}
    ||| % _config, format='table'
  ))
;

local freeCPUClusterGraph =
  graphPanel.new(
    'Average normalized load average(1min) per cluster',
    description='Average of normalized load average across all nodes of a cluster. If the values is above 1, it means that the cluster is probably saturated.',
    datasource='$datasource',
    span=12,
    format='none',
    stack=false,
    fill=1,
    fillGradient=5,
    min=0,
  )
  .addTarget(prometheus.target(
    |||
      avg(
        node_load1{%(clusterLabel)s=~"$cluster",}
        /
        count without (cpu) (
          count without (mode) (
            node_cpu_seconds_total * on(node) group_left() kube_node_labels{nodepool=~"$nodepool"}
          )
        )
      ) by (%(clusterLabel)s)
    ||| % _config, legendFormat='{{%(clusterLabel)s}}' % _config
  ))
;

local freeCPUTablePanel =
  tablePanel.new(
    title='Current nodes with highest normalized load average (1min)',
    description=
    |||
      Top 10 nodes with highest normalized load average. Nodes with a high normalized load average do not represent a real problem, it only means that pods should probably not be scheduled to them.

      If you'd like to see more details about resource consumption of a particular node, you can do so by clicking at the node name.
    |||,
    datasource='$datasource',
    span=6,
    styles=[adminNodeDashboardRedirectStyle, hiddenNodepoolStyle, hiddenTimeStyle, noneValueStyle { alias: 'Normalized load average' }]
  )
  .addTarget(prometheus.target(
    |||
      sort(
        topk(10,
          sum(
            node_load1{%(clusterLabel)s=~"$cluster"} * on(node) group_left(nodepool) kube_node_labels{nodepool=~"$nodepool"}
            /
            count without (cpu) (
              count without (mode) (
                node_cpu_seconds_total * on(node) group_left(nodepool) kube_node_labels{nodepool=~"$nodepool"}
              )
            )
          ) by (node, nodepool, %(clusterLabel)s)
        )
      )
    ||| % _config, format='table', instant=true
  ))
;

local freeCPUHeatMap =
  heatmapPanel.new(
    title='Normalized Load average(1 min)',
    description='Normalized load average per node, distributed in buckets. If the distribution is above 1, it means that our cluster is probably overbooked.',
    datasource='$datasource',
    span=6,
    yAxis_format='none',
    dataFormat='timeseries',
    yAxis_min=0,
    yBucketBound='auto',
    yBucketSize=1,
    hideZeroBuckets=true,
    highlightCards=true,
    color_mode='spectrum',
    color_colorScheme='interpolateGreens',
  )
  .addTarget(prometheus.target(
    |||
      sum(
        node_load1{%(clusterLabel)s=~"$cluster",}
        /
        count without (cpu) (
          count without (mode) (
            node_cpu_seconds_total * on(node) group_left() kube_node_labels{nodepool=~"$nodepool"}
          )
        )
      ) by (node, %(clusterLabel)s)
    ||| % _config, format='table'
  ))
;

{
  grafanaDashboards+:: {
    'gitpod-nodes-overview.json':
      dashboard.new(
        '%sNodes Overview' % _config.dashboardNamePrefix,
        time_from='now-1h',
        tags=(_config.dashboardTags),
        timezone='utc',
        refresh='30s',
        graphTooltip='shared_crosshair',
        uid='gitpod-nodes-overview'
      )
      .addTemplate(datasourceTemplate)
      .addTemplate(clusterTemplate)
      .addTemplate(nodepoolTemplate)
      .addPanel(
        numberOfNodesStatsPanel,
        gridPos={ x: 0, y: 0, h: 3, w: 6 }
      )
      .addRow(
        row.new('CPU')
        .addPanel(freeCPUClusterGraph)
        .addPanel(freeCPUTablePanel)
        .addPanel(freeCPUHeatMap)
      )
      .addRow(
        row.new('Memory')
        .addPanel(freeMemoryClusterGraph)
        .addPanel(freeMemoryTablePanel)
        .addPanel(freeMemoryHeatMap)
      )
      .addRow(
        row.new('Disk')
        .addPanel(freeDiskClusterGraph)
        .addPanel(freeDiskTablePanel)
        .addPanel(freeDiskHeatMap)
      ),
  },
}
