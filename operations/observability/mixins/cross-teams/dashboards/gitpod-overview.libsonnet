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
local link = grafana.link;
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
    query='label_values(gitpod_ws_manager_workspace_phase_total, %s)' % _config.clusterLabel,
    current='all',
    hide=if _config.showMultiCluster then '' else 'hide',
    refresh=2,
    includeAll=true,
    multi=true,
    sort=1
  );

// Panels
local runningWorkspacesGraph =
  graphPanel.new(
    '$cluster: Running Workspaces',
    datasource='$datasource',
    format='none',
    stack=false,
    fill=1,
    fillGradient=5,
    min=0,
    repeat='cluster',
  )
  .addTarget(prometheus.target('sum(gitpod_ws_manager_workspace_phase_total{%(clusterLabel)s=~"$cluster", phase="RUNNING"}) by (type)' % _config, legendFormat='{{ type }}'))
  .addTarget(prometheus.target('sum(gitpod_ws_manager_workspace_activity_total{%(clusterLabel)s=~"$cluster",active="false"})' % _config, legendFormat='Regular Not Active'))
  .addSeriesOverride({ alias: 'REGULAR', color: '#73BF69' })
  .addSeriesOverride({ alias: 'PREBUILD', color: '#5794F2' })
  .addSeriesOverride({ alias: 'PROBE', color: '#B877D9' })
  .addSeriesOverride({ alias: 'Regular Not Active', color: '#FADE2A' })
;

local wsNodeLoadAverageGraph =
  graphPanel.new(
    datasource='$datasource',
    title="$cluster: Workspace node's normalized load average",
    description=
    |||
      Nodes with a high normalized load average do not represent a real problem, it only means that pods should probably not be scheduled to them.

      If you'd like to see more details about resource consumption of a particular node, you can do so by clicking at the node name.
    |||,
    format='none',
    fill=1,
    fillGradient=5,
    min=0,
    repeat='cluster',
  )
  .addTarget(prometheus.target(
    |||
      topk(5, sum(nodepool:node_load1:normalized{%(clusterLabel)s=~"$cluster", nodepool=~".*workspace.*"}) by (node))
    ||| % _config, legendFormat='{{node}}'
  ))
;

local workspaceStartupTimeHeatMap =
  heatmapPanel.new(
    title='$cluster: Regular Workspace Startup time',
    datasource='$datasource',
    yAxis_format='s',
    dataFormat='tsbuckets',
    yBucketBound='auto',
    hideZeroBuckets=true,
    highlightCards=true,
    color_mode='spectrum',
    color_colorScheme='interpolateGreens',
    repeat='cluster',
  )
  .addTarget(prometheus.target(
    'sum(rate(gitpod_ws_manager_workspace_startup_seconds_bucket{%(clusterLabel)s=~"$cluster",type="REGULAR"}[$__rate_interval])) by (le)' % _config,
    legendFormat='{{le}}' % _config,
    format='heatmap'
  ))
;

local workspaceFailuresGraph =
  graphPanel.new(
    '$cluster: Workspace Failures per second',
    datasource='$datasource',
    format='none',
    stack=false,
    fill=1,
    fillGradient=5,
    min=0,
    repeat='cluster',
  )
  .addTarget(prometheus.target(
    |||
      sum(
        rate(gitpod_ws_manager_workspace_stops_total{%(clusterLabel)s=~"$cluster", reason="failed"}[5m])
      ) by (%(clusterLabel)s, type)
    ||| % _config, legendFormat='{{type}}'
  ))
  .addSeriesOverride({ alias: 'REGULAR', color: '#73BF69' })
  .addSeriesOverride({ alias: 'PREBUILD', color: '#5794F2' })
  .addSeriesOverride({ alias: 'PROBE', color: '#B877D9' })
;

local workspacePhasesGraph =
  graphPanel.new(
    '$cluster: Workspace Phases',
    datasource='$datasource',
    format='none',
    stack=false,
    fill=1,
    fillGradient=5,
    min=0,
    repeat='cluster',
  )
  .addTarget(prometheus.target('gitpod_ws_manager_workspace_phase_total{%(clusterLabel)s=~"$cluster", phase!="RUNNING"}' % _config, legendFormat='{{type}} - {{phase}}'))
  // Regular use different levels of green
  .addSeriesOverride({ alias: 'REGULAR - INITIALIZING', color: '#C8F2C2' })
  .addSeriesOverride({ alias: 'REGULAR - CREATING', color: '#96D98D' })
  .addSeriesOverride({ alias: 'REGULAR - PENDING', color: '#56A64B' })
  .addSeriesOverride({ alias: 'REGULAR - STOPPING', color: '#37872D' })
  .addSeriesOverride({ alias: 'REGULAR - STOPPED', color: 'rgb(30, 80, 30)' })
  // Prebuild use different levels of blue
  .addSeriesOverride({ alias: 'PREBUILD - INITIALIZING', color: '#C0D8FF' })
  .addSeriesOverride({ alias: 'PREBUILD - CREATING', color: '#8AB8FF' })
  .addSeriesOverride({ alias: 'PREBUILD - PENDING', color: '#3274D9' })
  .addSeriesOverride({ alias: 'PREBUILD - STOPPING', color: '#1F60C4' })
  .addSeriesOverride({ alias: 'PREBUILD - STOPPED', color: 'rgb(30, 30, 80)' })
;

local clusterScaleSizeGraph =
  graphPanel.new(
    '$cluster: Number of nodes',
    datasource='$datasource',
    format='short',
    stack=false,
    fill=1,
    fillGradient=5,
    min=0,
    repeat='cluster',
  )
  .addTarget(prometheus.target('count(kube_node_labels{%(clusterLabel)s=~"$cluster"}) by (nodepool)' % _config, legendFormat='{{nodepool}}'))
;

{
  grafanaDashboards+:: {
    'gitpod-overview.json':
      dashboard.new(
        '%sOverview' % _config.dashboardNamePrefix,
        time_from='now-1h',
        tags=(_config.dashboardTags),
        timezone='utc',
        refresh='30s',
        graphTooltip='shared_crosshair',
        uid='gitpod-overview'
      )
      .addTemplate(datasourceTemplate)
      .addTemplate(clusterTemplate)
      .addRow(
        row.new('Running workspaces')
        .addPanel(runningWorkspacesGraph)
      )
      .addRow(
        row.new("Workspace node's normalized Load Average")
        .addPanel(wsNodeLoadAverageGraph)
      )
      .addRow(
        row.new('Workspace Startup time')
        .addPanel(workspaceStartupTimeHeatMap)
      )
      .addRow(
        row.new('Workspace Phases')
        .addPanel(workspacePhasesGraph)
      )
      .addRow(
        row.new('Workspace failures')
        .addPanel(workspaceFailuresGraph)
      )
      .addRow(
        row.new('Cluster size')
        .addPanel(clusterScaleSizeGraph)
      ),
  },
}
