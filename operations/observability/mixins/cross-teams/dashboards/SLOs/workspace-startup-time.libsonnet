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
local _config = (import '../../config.libsonnet')._config;

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
    query='label_values(gitpod_ws_manager_workspace_startup_seconds_count, %s)' % _config.clusterLabel,
    current='all',
    hide=if _config.showMultiCluster then '' else 'hide',
    refresh=2,
    includeAll=true,
    multi=true,
    sort=1
  );

local higherStartupSLOStatPanel =
  statPanel.new(
    'SLO and Error budget - Workspace Start up time < 128s (~2 min)',
    description=
    |||
      Current SLO target and remaining error budget for the higher latency workspace SLO.

      **How to interpret:**
      Imagine we have a 95% target and 5% error budget left, that means that all workspaces started quicker than our SLO target in the last month.
      On the other hand, if we have a 95% target and -5% error budget left, that means that 10% of our workspaces took longer than our SLO target to start up.
    |||,
    datasource='$datasource',
    min=0,
    max=1,
    reducerFunction='lastNotNull',
    orientation='horizontal',
    unit='percentunit',
    colorMode='background',
    graphMode='none',
  )
  .addTarget(prometheus.target('0.95', legendFormat='Target'))
  .addTarget(prometheus.target(
    |||
      (
        sum(rate(gitpod_ws_manager_workspace_startup_seconds_bucket{%(clusterLabel)s=~"$cluster",type="REGULAR", le="128"}[30d]))
        /
        sum(rate(gitpod_ws_manager_workspace_startup_seconds_count{%(clusterLabel)s=~"$cluster",type="REGULAR"}[30d]))
      ) - 0.95
    ||| % _config, legendFormat='Monthly error budget remaining'
  ))
  .addThreshold({ color: 'light-red', value: null })
  .addThreshold({ color: 'dark-green', value: 0 })
  .addThreshold({ color: 'rgb(255, 255, 255)', value: '0.95' })
;

local lowerStartupSLOStatPanel =
  statPanel.new(
    'SLO and Error budget - Workspace Start up time < 16s',
    description=
    |||
      Current SLO target and remaining error budget for the higher latency workspace SLO.

      **How to interpret:**

      Imagine we have a 95% target and 5% error budget left, that means that all workspaces started quicker than our SLO target in the last month.
      On the other hand, if we have a 95% target and -5% error budget left, that means that 10% of our workspaces took longer than our SLO target to start up.
    |||,
    datasource='$datasource',
    min=0,
    max=1,
    reducerFunction='lastNotNull',
    orientation='horizontal',
    unit='percentunit',
    colorMode='background',
    graphMode='none',
  )
  .addTarget(prometheus.target('0.5', legendFormat='Target'))
  .addTarget(prometheus.target(
    |||
      (
        sum(rate(gitpod_ws_manager_workspace_startup_seconds_bucket{%(clusterLabel)s=~"$cluster",type="REGULAR", le="16"}[30d]))
        /
        sum(rate(gitpod_ws_manager_workspace_startup_seconds_count{%(clusterLabel)s=~"$cluster",type="REGULAR"}[30d]))
      ) - 0.5
    ||| % _config, legendFormat='Monthly error budget remaining'
  ))
  .addThreshold({ color: 'light-red', value: null })
  .addThreshold({ color: 'dark-green', value: 0 })
  .addThreshold({ color: 'rgb(255, 255, 255)', value: '0.5' })
;

local workspaceStartupTimeHeatMap =
  heatmapPanel.new(
    title='$cluster: Regular Workspace Startup time heatmap',
    datasource='$datasource',
    yAxis_format='s',
    dataFormat='tsbuckets',
    yBucketBound='auto',
    hideZeroBuckets=true,
    highlightCards=true,
    color_mode='spectrum',
    color_colorScheme='interpolateGreens',
    repeat='%s' % _config.clusterLabel,
  )
  .addTarget(prometheus.target(
    'sum(rate(gitpod_ws_manager_workspace_startup_seconds_bucket{%(clusterLabel)s=~"$cluster",type="REGULAR"}[$__rate_interval])) by (le)' % _config,
    legendFormat='{{le}}',
    format='heatmap'
  ))
;

local workspaceStartupTimeQuantiles =
  graphPanel.new(
    '$cluster: Regular Workspace Startup time Percentiles',
    datasource='$datasource',
    format='s',
    stack=false,
    fill=1,
    legend_show=true,
    repeat='%s' % _config.clusterLabel,
  )
  .addTarget(prometheus.target(
    |||
      histogram_quantile(0.95,
        sum(rate(gitpod_ws_manager_workspace_startup_seconds_bucket{%(clusterLabel)s=~"$cluster",type="REGULAR"}[$__rate_interval])) by (le)
      )
    ||| % _config, legendFormat='95th Percentile'
  ))
  .addTarget(prometheus.target(
    |||
      histogram_quantile(0.5,
        sum(rate(gitpod_ws_manager_workspace_startup_seconds_bucket{%(clusterLabel)s=~"$cluster",type="REGULAR"}[$__rate_interval])) by (le)
      )
    ||| % _config, legendFormat='50th Percentile'
  ))
  .addTarget(prometheus.target(
    |||
      sum(rate(gitpod_ws_manager_workspace_startup_seconds_sum{%(clusterLabel)s=~"$cluster",type="REGULAR"}[$__rate_interval]))
      /
      sum(rate(gitpod_ws_manager_workspace_startup_seconds_count{%(clusterLabel)s=~"$cluster",type="REGULAR"}[$__rate_interval]))
    ||| % _config, legendFormat='avg'
  ));

{
  grafanaDashboards+:: {
    'gitpod-slo-workspace-startuptime.json':
      dashboard.new(
        '%sSLO / Workspace Startup time' % _config.dashboardNamePrefix,
        time_from='now-1h',
        tags=(_config.dashboardTags),
        timezone='utc',
        refresh='30s',
        graphTooltip='shared_crosshair',
        uid='gitpod-slo-workspace-startuptime'
      )
      .addTemplate(datasourceTemplate)
      .addTemplate(clusterTemplate)
      .addPanel(higherStartupSLOStatPanel, gridPos={ x: 4, y: 0, w: 8, h: 4 })
      .addPanel(lowerStartupSLOStatPanel, gridPos={ x: 12, y: 0, w: 8, h: 4 })
      .addRow(
        row.new('Workspace startup time - User experience')
        .addPanel(workspaceStartupTimeHeatMap, gridPos={ y: 5 })
        .addPanel(workspaceStartupTimeQuantiles, gridPos={ y: 13 })
      ),
  },
}
