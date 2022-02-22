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
    hide=if _config.showMultiCluster then '' else '2',
    refresh=2,
    includeAll=false,
    multi=false,
    sort=1
  );

local nodeTemplate =
  template.new(
    name='node',
    datasource='$datasource',
    query='label_values(kube_node_labels{%s=~"$cluster", nodepool="workspace-pool"}, node)' % _config.clusterLabel,
    current='all',
    refresh=2,
    includeAll=false,
    multi=false,
    sort=1
  );

local workspaceTemplate =
  template.new(
    name='workspace',
    datasource='$datasource',
    query='label_values(kube_pod_labels{%s=~"$cluster",component="workspace"}, pod)' % _config.clusterLabel,
    current='all',
    refresh=2,
    includeAll=false,
    multi=false,
    sort=1
  );

local ownerStatPanel =
  statPanel.new(
    'Workspace Owner',
    datasource='$datasource',
    transparent='true',
    reducerFunction='lastNotNull',
    colorMode='none'
  )
  .addTarget(prometheus.target('kube_pod_labels{pod="$workspace", owner=~".+"}', legendFormat='{{owner}}'))
  .addDataLink(
    {
      title: "See user in 'Gitpod Admin'",
      url: _config.gitpodURL + '/admin/users/${__field.labels.owner}',
      targetBlank: true,
    }
  )
  +
  {
    // Grafonnet doesn't provide a good way to override textMode.
    // PR opened upstream: https://github.com/grafana/grafonnet-lib/pull/342
    options+: {
      textMode: 'name',
    },
  }
;

local metaIDStatPanel =
  statPanel.new(
    'Workspace ID',
    datasource='$datasource',
    transparent='true',
    reducerFunction='lastNotNull',
    colorMode='none'
  )
  .addTarget(prometheus.target('kube_pod_labels{pod="$workspace", metaID=~".+"}', legendFormat='{{metaID}}'))
  .addDataLink(
    {
      title: "See workspace in 'Gitpod Admin'",
      url: _config.gitpodURL + '/admin/workspaces/${__field.labels.metaID}',
      targetBlank: true,
    }
  )
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
  .addTarget(prometheus.target('time() - kube_pod_created{pod="$workspace"}' % _config, legendFormat='Uptime'))
;

local cpuUtilizationGraph =
  graphPanel.new(
    'CPU Utilization',
    datasource='$datasource',
    format='none',
    span=4,
    fill=1,
    fillGradient=5,
    min=0,
  )
  .addTarget(prometheus.target(
    |||
      sum(
        rate(container_cpu_usage_seconds_total{container!="POD", container!="", cluster="$cluster", pod="$workspace"}[$__rate_interval])
      ) by (pod)
    ||| % _config, legendFormat='CPU Utilization'
  ))
;


local cpuSaturationGraph =
  graphPanel.new(
    'CPU Saturation',
    datasource='$datasource',
    formatY1='percentunit',
    formatY2='s',
    span=4,
    fill=1,
    fillGradient=5,
    min=0,
  )
  .addTarget(prometheus.target(
    |||
      sum(
        rate(container_cpu_usage_seconds_total{container!="POD", container!="", cluster="$cluster", pod="$workspace"}[$__rate_interval])
      ) by (pod)
      /
      sum(
        kube_pod_container_resource_limits{container!="POD", cluster="$cluster", pod="$workspace", resource="cpu"}
       ) by (pod)
    ||| % _config, legendFormat='CPU Saturation'
  ))
  .addTarget(prometheus.target(
    |||
      sum(
        rate(container_cpu_cfs_throttled_seconds_total{container!="POD", pod!="", cluster="$cluster", pod="$workspace"}[$__rate_interval])
      ) by (pod)
    ||| % _config, legendFormat='CPU Throttles'
  ))
  .addSeriesOverride({ alias: '/CPU Throttles/', yaxis: 2 })
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
  .addTarget(prometheus.target(
    |||
      sum(
        container_memory_working_set_bytes{container!="POD", container!="", cluster="$cluster", pod="$workspace"}
      ) by (pod)
    ||| % _config, legendFormat='Memory Utilization'
  ))
;

local memorySaturationGraph =
  graphPanel.new(
    'Memory Saturation',
    datasource='$datasource',
    formatY1='percentunit',
    formatY2='s',
    span=6,
    fill=1,
    fillGradient=5,
    min=0,
  )
  .addTarget(prometheus.target(
    |||
      sum(
        container_memory_working_set_bytes{container!="POD", container!="", cluster="$cluster", pod="$workspace"}
      ) by (pod)
      /
      sum(
        kube_pod_container_resource_limits{container!="POD", cluster="$cluster", pod="$workspace", resource="memory"}
      ) by (pod)
    ||| % _config, legendFormat='Memory Saturation'
  ))
;

local networkUtilizationGraph =
  graphPanel.new(
    'Network Utilization',
    datasource='$datasource',
    format='Bps',
    span=4,
    fill=1,
    fillGradient=5,
    min=0,
  )
  .addTarget(prometheus.target(
    |||
      sum (
        rate(container_network_receive_bytes_total{container!="POD", pod!="", cluster="$cluster", pod="$workspace"}[$__rate_interval])
      ) by (pod)
    ||| % _config, legendFormat='Received'
  ))
  .addTarget(prometheus.target(
    |||
      sum (
        rate(container_network_transmit_bytes_total{container!="POD", pod!="", cluster="$cluster", pod="$workspace"}[$__rate_interval])
      ) by (pod)
    ||| % _config, legendFormat='Transmitted'
  ))
;

local networkSaturationGraph =
  graphPanel.new(
    'Network Saturation (Packets dropped)',
    datasource='$datasource',
    format='pps',
    span=4,
    fill=1,
    fillGradient=5,
    min=0,
  )
  .addTarget(prometheus.target(
    |||
      sum (
        rate(container_network_receive_packets_dropped_total{container!="POD", pod!="", cluster="$cluster", pod="$workspace"}[$__rate_interval])
      ) by (pod)
    ||| % _config, legendFormat='While Receiving'
  ))
  .addTarget(prometheus.target(
    |||
      sum (
        rate(container_network_transmit_packets_dropped_total{container!="POD", pod!="", cluster="$cluster", pod="$workspace"}[$__rate_interval])
      ) by (pod)
    ||| % _config, legendFormat='While Transmitting'
  ))
;

local networkErrorsGraph =
  graphPanel.new(
    'Network Errors',
    datasource='$datasource',
    format='errors/s',
    span=4,
    fill=1,
    fillGradient=5,
    min=0,
  )
  .addTarget(prometheus.target(
    |||
      sum (
        rate(container_network_receive_errors_total{container!="POD", pod!="", cluster="$cluster", pod="$workspace"}[$__rate_interval])
      ) by (pod)
    ||| % _config, legendFormat='While Receiving'
  ))
  .addTarget(prometheus.target(
    |||
      sum (
        rate(container_network_transmit_errors_total{container!="POD", pod!="", cluster="$cluster", pod="$workspace"}[$__rate_interval])
      ) by (pod)
    ||| % _config, legendFormat='While Transmitting'
  ))
;

{
  grafanaDashboards+:: {
    'gitpod-admin-workspaces.json':
      dashboard.new(
        '%sAdmin / Workspace' % _config.dashboardNamePrefix,
        time_from='now-1h',
        tags=(_config.dashboardTags),
        timezone='utc',
        refresh='30s',
        graphTooltip='shared_crosshair',
        uid='gitpod-admin-workspaces'
      )
      .addTemplate(datasourceTemplate)
      .addTemplate(clusterTemplate)
      .addTemplate(nodeTemplate)
      .addTemplate(workspaceTemplate)
      .addPanel(ownerStatPanel, gridPos={ x: 4, y: 0, w: 8, h: 4 })
      .addPanel(metaIDStatPanel, gridPos={ x: 12, y: 0, w: 8, h: 4 })
      .addRow(
        row.new('Workspace info')
        .addPanel(uptimeGraph)
        .addPanel(cpuUtilizationGraph)
        .addPanel(cpuSaturationGraph)
        .addPanel(memoryUtilizationGraph)
        .addPanel(memorySaturationGraph)
        .addPanel(networkUtilizationGraph)
        .addPanel(networkSaturationGraph)
        .addPanel(networkErrorsGraph)
      ),
  },
}
