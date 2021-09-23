/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

/*
*
*/

local grafana = import 'github.com/grafana/grafonnet-lib/grafonnet/grafana.libsonnet';
local dashboard = grafana.dashboard;
local row = grafana.row;
local prometheus = grafana.prometheus;
local template = grafana.template;
local graphPanel = grafana.graphPanel;
local tablePanel = grafana.tablePanel;
local heatmapPanel = grafana.heatmapPanel;
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
    query='label_values(container_cpu_usage_seconds_total, %s)' % _config.clusterLabel,
    current='all',
    hide=if _config.showMultiCluster then '' else 'hide',
    refresh=2,
    includeAll=false,
    multi=false,
    sort=1
  );

local nodepoolTemplate =
  template.new(
    name='nodepool',
    datasource='$datasource',
    query='label_values(kube_node_labels{%s="$cluster"}, nodepool)' % _config.clusterLabel,
    current='all',
    refresh=2,
    includeAll=false,
    multi=false,
    sort=1
  )
;

local nodeTemplate =
  template.new(
    name='node',
    datasource='$datasource',
    query='label_values(kube_node_labels{%s=~"$cluster", nodepool="$nodepool"}, node)' % _config.clusterLabel,
    current='all',
    refresh=2,
    includeAll=false,
    multi=false,
    sort=1
  )
;

local hiddenTimeStyle = {
  type: 'hidden',
  pattern: 'Time',
}
;

local noneValueStyle = {
  unit: 'none',
  decimals: 1,
  pattern: 'Value',
  type: 'number',
}
;

local byteValueStyle = {
  unit: 'bytes',
  decimals: 1,
  pattern: 'Value',
  type: 'number',
}
;

local adminWorkspaceDashboardRedirectStyle = {
  pattern: 'pod',
  link: true,
  linkUrl: 'd/gitpod-admin-workspaces/gitpod-admin-workspaces?var-datasource=$datasource&var-cluster=$cluster&var-nodepool=$nodepool&var-node=$node&var-workspace=$__cell',
  linkTargetBlank: true,
}
;

local kernelStatPanel =
  statPanel.new(
    'Kernel',
    datasource='$datasource',
    transparent='true',
    reducerFunction='last',
    colorMode='none'
  )
  .addTarget(prometheus.target('node_uname_info{node="$node"}', legendFormat='{{release}}'))
  +
  {
    // Grafonnet doesn't provide a good way to override textMode.
    // PR opened upstream: https://github.com/grafana/grafonnet-lib/pull/342
    options+: {
      textMode: 'name',
    },
  }
;

local uptimeGraph =
  graphPanel.new(
    'Uptime',
    datasource='$datasource',
    format='s',
    span=4,
    fill=1,
    fillGradient=5,
    min=0,
  )
  .addTarget(prometheus.target('time() - node_boot_time_seconds{instance="$node"}', legendFormat='Uptime'))
;

local workspaceDensityGraph =
  graphPanel.new(
    '# of Workspaces',
    datasource='$datasource',
    format='short',
    span=4,
    fill=1,
    fillGradient=5,
    min=0,
  )
  .addTarget(prometheus.target(
    |||
      count(
        sum(container_cpu_cfs_periods_total{node="$node", container="workspace"} * on(pod) group_left(workspace_type) kube_pod_labels{component="workspace"}) by (pod, workspace_type)
      ) by (workspace_type)
    |||, legendFormat='{{workspace_type}}'
  ))
;

local topCPUConsumersGraph =
  graphPanel.new(
    'Top CPU Consumers',
    datasource='$datasource',
    format='none',
    span=4,
    fill=1,
    fillGradient=5,
    stack=true,
    min=0,
  )
  .addTarget(prometheus.target(
    |||
      topk(10,
        sum(
          rate(container_cpu_usage_seconds_total{container!="", node="$node"}[$__rate_interval])
        ) by (pod)
      )
    |||, legendFormat='{{pod}}'
  ))
  { tooltip+: { sort: 2 } }
;

local topMemoryConsumersGraph =
  graphPanel.new(
    'Top Memory Consumers',
    datasource='$datasource',
    format='bytes',
    span=4,
    fill=1,
    fillGradient=5,
    stack=true,
    min=0,
  )
  .addTarget(prometheus.target(
    |||
      topk(10,
        sum(
          container_memory_working_set_bytes{container!="", node="$node"}
        ) by (pod)
      )
    |||, legendFormat='{{pod}}'
  ))
  { tooltip+: { sort: 2 } }
;

local topNetworkConsumersGraph =
  graphPanel.new(
    'Top Network Consumers',
    datasource='$datasource',
    format='Bps',
    span=4,
    fill=1,
    fillGradient=5,
    stack=true,
    min=0,
  )
  .addTarget(prometheus.target(
    |||
      topk(10,
        sum (
          rate(container_network_receive_bytes_total{pod!="", cluster="$cluster", node="$node"}[$__rate_interval])
        ) by (pod) +
        sum (
          rate(container_network_transmit_bytes_total{pod!="", node="$node"}[$__rate_interval])
        ) by (pod)
      )
    |||, legendFormat='{{pod}}'
  ))
  { tooltip+: { sort: 2 } }
;

local top10CPUTablePanel =
  tablePanel.new(
    title='Current Top 10 CPU consumers',
    description=
    |||
      Top 10 CPU consumer pods of the selected Node

      If you'd like to see more details about resource consumption of a particular pod, you can do so by clicking at the pod name.
    |||,
    datasource='$datasource',
    span=4,
    styles=[adminWorkspaceDashboardRedirectStyle, hiddenTimeStyle, noneValueStyle { alias: 'CPU consumption' }]
  )
  .addTarget(prometheus.target(
    |||
      sort(
        topk(10,
          sum(
            rate(container_cpu_usage_seconds_total{container!="", node="$node"}[$__rate_interval])
          ) by (pod)
        )
      )
    ||| % _config, format='table', instant=true
  ))
;

local top10MemoryTablePanel =
  tablePanel.new(
    title='Current Top 10 Memory consumers',
    description=
    |||
      Top 10 Memory consumer pods of the selected Node

      If you'd like to see more details about resource consumption of a particular pod, you can do so by clicking at the pod name.
    |||,
    datasource='$datasource',
    span=4,
    styles=[adminWorkspaceDashboardRedirectStyle, hiddenTimeStyle, byteValueStyle { alias: 'Memory consumption' }]
  )
  .addTarget(prometheus.target(
    |||
      sort(
        topk(10,
          sum(
            container_memory_working_set_bytes{container!="", node="$node"}
          ) by (pod)
        )
      )
    ||| % _config, format='table', instant=true
  ))
;

local top10NetworkTablePanel =
  tablePanel.new(
    title='Current Top 10 Network consumers',
    description=
    |||
      Top 10 Network consumer pods of the selected Node

      If you'd like to see more details about resource consumption of a particular pod, you can do so by clicking at the pod name.
    |||,
    datasource='$datasource',
    span=4,
    styles=[adminWorkspaceDashboardRedirectStyle, hiddenTimeStyle, byteValueStyle { alias: 'Network consumptions' }]
  )
  .addTarget(prometheus.target(
    |||
      sort(
        topk(10,
          sum (
            rate(container_network_receive_bytes_total{pod!="", cluster="$cluster", node="$node"}[$__rate_interval])
          ) by (pod) +
          sum (
            rate(container_network_transmit_bytes_total{pod!="", node="$node"}[$__rate_interval])
          ) by (pod)
        )
      )
    ||| % _config, format='table', instant=true
  ))
;

local cpuUtilizationGraph =
  graphPanel.new(
    'CPU Utilization',
    datasource='$datasource',
    formatY1='percentunit',
    formatY2='s',
    span=6,
    fill=1,
    fillGradient=5,
    min=0,
    stack=true
  )
  .addTarget(prometheus.target(
    |||
      (
        (1 - rate(node_cpu_seconds_total{mode="idle", instance="$node"}[$__interval]))
      / ignoring(cpu) group_left
        count without (cpu)( node_cpu_seconds_total{mode="idle", instance="$node"})
      )
    |||, legendFormat='{{cpu}}'
  ))
;

local cpuSaturationGraph =
  graphPanel.new(
    'CPU Saturation',
    datasource='$datasource',
    format='none',
    span=6,
    fill=0,
    fillGradient=5,
    min=0,
  )
  .addTarget(prometheus.target('node_load1{instance="$node"}', legendFormat='1m load average'))
  .addTarget(prometheus.target('node_load5{instance="$node"}', legendFormat='5m load average'))
  .addTarget(prometheus.target('node_load15{instance="$node"}', legendFormat='15m load average'))
  .addTarget(prometheus.target('count(node_cpu_seconds_total{instance="$node", mode="idle"})', legendFormat='logical cores'))
;

local memoryUtilizationGraph =
  graphPanel.new(
    'Memory Utilization',
    datasource='$datasource',
    format='bytes',
    span=6,
    fill=1,
    fillGradient=5,
    min=0,
  )
  .addTarget(prometheus.target('node_memory_MemTotal_bytes{instance="$node"} - node_memory_MemAvailable_bytes{instance="$node"}', legendFormat='Used'))
  .addTarget(prometheus.target('node_memory_MemTotal_bytes{instance="$node"}', legendFormat='Memory Size'))
  .addSeriesOverride({ alias: '/Memory Size/', fillGradient: 0, fill: 0 })
;

local memorySaturationGraph =
  graphPanel.new(
    'Memory Saturation (page faults)',
    datasource='$datasource',
    formatY1='percentunit',
    formatY2='s',
    span=6,
    fill=1,
    fillGradient=5,
    min=0,
  )
  .addTarget(prometheus.target(
    'instance:node_vmstat_pgmajfault:rate1m{instance="$node"}', legendFormat='Memory Saturation'
  ))
;

local networkUtilizationGraph =
  graphPanel.new(
    'Network Utilization',
    datasource='$datasource',
    format='Bps',
    span=6,
    fill=1,
    fillGradient=5,
  )
  .addTarget(prometheus.target('instance:node_network_receive_bytes_excluding_lo:rate1m{instance="$node"}', legendFormat='Received'))
  .addTarget(prometheus.target('instance:node_network_transmit_bytes_excluding_lo:rate1m{instance="$node"}', legendFormat='Transmitted'))
  .addSeriesOverride({ alias: '/Transmitted/', transform: 'negative-Y' })
;

local networkSaturationGraph =
  graphPanel.new(
    'Network Saturation (drops)',
    datasource='$datasource',
    format='rps',
    span=6,
    fill=1,
    fillGradient=5,
  )
  .addTarget(prometheus.target('instance:node_network_receive_drop_excluding_lo:rate1m{instance="$node"}', legendFormat='Received'))
  .addTarget(prometheus.target('instance:node_network_transmit_drop_excluding_lo:rate1m{instance="$node"}', legendFormat='Transmitted'))
  .addSeriesOverride({ alias: '/Transmitted/', transform: 'negative-Y' })
;

local diskIOkUtilizationGraph =
  graphPanel.new(
    'Disk IO Utilization',
    datasource='$datasource',
    format='percentunit',
    span=6,
    fill=1,
    fillGradient=5,
  )
  .addTarget(prometheus.target('instance_device:node_disk_io_time_seconds:rate1m{instance="$node"}', legendFormat='{{device}}'))
;

local diskIOkSaturationGraph =
  graphPanel.new(
    'Disk IO Saturation',
    datasource='$datasource',
    format='percentunit',
    span=6,
    fill=1,
    fillGradient=5,
  )
  .addTarget(prometheus.target('instance_device:node_disk_io_time_weighted_seconds:rate1m{instance="$node"}', legendFormat='{{device}}'))
;

local diskSpaceUtilizationGraph =
  graphPanel.new(
    'Disk Space Utilization',
    datasource='$datasource',
    format='percentunit',
    span=12,
    fill=1,
    fillGradient=5,
    legend_show=true,
  )
  .addTarget(prometheus.target(
    |||
      1 -
      (
        max without (mountpoint, fstype) (node_filesystem_avail_bytes{fstype!="shiftfs", instance="$node"})
      /
        max without (mountpoint, fstype) (node_filesystem_size_bytes{fstype!="shiftfs", instance="$node"})
      )
    |||, legendFormat='{{device}}'
  ))
;

{
  grafanaDashboards+:: {
    'gitpod-admin-nodes.json':
      dashboard.new(
        '%sAdmin / Node' % _config.dashboardNamePrefix,
        time_from='now-1h',
        tags=(_config.dashboardTags),
        timezone='utc',
        refresh='30s',
        graphTooltip='shared_crosshair',
        uid='gitpod-admin-nodes'
      )
      .addTemplate(datasourceTemplate)
      .addTemplate(clusterTemplate)
      .addTemplate(nodepoolTemplate)
      .addTemplate(nodeTemplate)
      .addRow(
        row.new('Misc')
        .addPanel(kernelStatPanel)
        .addPanel(uptimeGraph)
        .addPanel(workspaceDensityGraph)
        .addPanel(topCPUConsumersGraph)
        .addPanel(topMemoryConsumersGraph)
        .addPanel(topNetworkConsumersGraph)
        .addPanel(top10CPUTablePanel)
        .addPanel(top10MemoryTablePanel)
        .addPanel(top10NetworkTablePanel)
      )
      .addRow(
        row.new('USE Method')
        .addPanel(cpuUtilizationGraph)
        .addPanel(cpuSaturationGraph)
        .addPanel(memoryUtilizationGraph)
        .addPanel(memorySaturationGraph)
        .addPanel(networkUtilizationGraph)
        .addPanel(networkSaturationGraph)
        .addPanel(diskIOkUtilizationGraph)
        .addPanel(diskIOkSaturationGraph)
        .addPanel(diskSpaceUtilizationGraph)
      ),
  },
}
