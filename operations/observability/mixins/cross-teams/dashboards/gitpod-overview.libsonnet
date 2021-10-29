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
  .addSeriesOverride({ alias: 'GHOST', color: '#ffffff' })
  .addSeriesOverride({ alias: 'Regular Not Active', color: '#FADE2A' })
;

local noisyNeighborGraph =
  graphPanel.new(
    '$cluster: # of Regular Workspaces under Noisy Neighborhood',
    description=
    |||
      When a Node has a normalized load average higher than 1, that means that the workloads are demanding more compute power than the node is able to provide.
      When that happens, then all workloads may have degraded performance.

      This panel do not answer the question: "What is workload is demanding so much CPU?"
      But it does answer: "How many regular workspaces are experiencing degraded performance because of the noisy neightbor effect?"

      To find out the noisy neighbor, drill down to '%(dashboardNamePrefix)sNodes Overview' and explore nodes that have normalized load average higher than 1.
    ||| % _config,
    datasource='$datasource',
    format='none',
    stack=false,
    fill=1,
    fillGradient=5,
    min=0,
    repeat='cluster',
    nullPointMode='null as zero'
  )
  .addLink(link.dashboards(
    title='%sNodes Overview' % _config.dashboardNamePrefix,
    tags=[''],
    url='d/gitpod-nodes-overview/gitpod-nodes-overview',
    keepTime=true,
    targetBlank=true,
    includeVars=true,
  ))
  .addTarget(prometheus.target(
    |||
      sum(
        count(
          sum(container_cpu_cfs_periods_total{%(clusterLabel)s=~"$cluster", container="workspace"}) by (pod, node, %(clusterLabel)s) # Sum just to aggregate all containers into a single pod
          *
          on(pod) group_left() kube_pod_labels{component="workspace", workspace_type="regular", %(clusterLabel)s=~"$cluster"} # join to make sure we only count pods of regular workspaces
        ) by (node, %(clusterLabel)s)

        and # We are correlating workspaces with Nodes with high normalized load average

        (
          sum(
            instance:node_load1_per_cpu:ratio{cluster=~"$cluster"}
          ) by (node, %(clusterLabel)s) # Sum to remove all labels except node and %(clusterLabel)s, labels must match with the first part of the query
        ) > 1
      ) by (%(clusterLabel)s)
    ||| % _config, legendFormat='# of workspaces'
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
  .addSeriesOverride({ alias: 'GHOST', color: '#ffffff' })
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
  // Ghosts use different levels of white/grey
  .addSeriesOverride({ alias: 'GHOST - INITIALIZING', color: '#ffffff' })
  .addSeriesOverride({ alias: 'GHOST - CREATING', color: '#cccccc' })
  .addSeriesOverride({ alias: 'GHOST - PENDING', color: '#999999' })
  .addSeriesOverride({ alias: 'GHOST - STOPPING', color: '#666666' })
  .addSeriesOverride({ alias: 'GHOST - STOPPED', color: '#333333' })
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
        row.new('Noisy Neighborhood')
        .addPanel(noisyNeighborGraph)
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
