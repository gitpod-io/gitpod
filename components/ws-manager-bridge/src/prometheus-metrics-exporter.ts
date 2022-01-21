/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as prom from 'prom-client';
import { injectable } from 'inversify';
import { WorkspaceInstance } from '@gitpod/gitpod-protocol';
import { WorkspaceClusterWoTLS } from '@gitpod/gitpod-protocol/src/workspace-cluster';

@injectable()
export class PrometheusMetricsExporter {
  protected readonly workspaceStartupTimeHistogram: prom.Histogram<string>;
  protected readonly timeToFirstUserActivityHistogram: prom.Histogram<string>;
  protected readonly clusterScore: prom.Gauge<string>;
  protected readonly clusterCordoned: prom.Gauge<string>;
  protected readonly statusUpdatesTotal: prom.Counter<string>;

  protected activeClusterNames: string[] = [];

  constructor() {
    this.workspaceStartupTimeHistogram = new prom.Histogram({
      name: 'workspace_startup_time',
      help: 'The time until a workspace instance is marked running',
      labelNames: ['neededImageBuild', 'region'],
      buckets: prom.exponentialBuckets(2, 2, 10),
    });
    this.timeToFirstUserActivityHistogram = new prom.Histogram({
      name: 'first_user_activity_time',
      help: 'The time between a workspace is running and first user activity',
      labelNames: ['region'],
      buckets: prom.exponentialBuckets(2, 2, 10),
    });
    this.clusterScore = new prom.Gauge({
      name: 'gitpod_ws_manager_bridge_cluster_score',
      help: 'Score of the individual registered workspace cluster',
      labelNames: ['workspace_cluster'],
    });
    this.clusterCordoned = new prom.Gauge({
      name: 'gitpod_ws_manager_bridge_cluster_cordoned',
      help: 'Cordoned status of the individual registered workspace cluster',
      labelNames: ['workspace_cluster'],
    });
    this.statusUpdatesTotal = new prom.Counter({
      name: 'gitpod_ws_manager_bridge_status_updates_total',
      help: 'Total workspace status updates received',
      labelNames: ['workspace_cluster', 'known_instance'],
    });
  }

  observeWorkspaceStartupTime(instance: WorkspaceInstance): void {
    const timeToRunningSecs =
      (new Date(instance.startedTime!).getTime() - new Date(instance.creationTime).getTime()) / 1000;
    this.workspaceStartupTimeHistogram.observe(
      {
        neededImageBuild: JSON.stringify(instance.status.conditions.neededImageBuild),
        region: instance.region,
      },
      timeToRunningSecs,
    );
  }

  observeFirstUserActivity(instance: WorkspaceInstance, firstUserActivity: string): void {
    if (!instance.startedTime) {
      return;
    }

    const timeToFirstUserActivity =
      (new Date(firstUserActivity).getTime() - new Date(instance.startedTime!).getTime()) / 1000;
    this.timeToFirstUserActivityHistogram.observe(
      {
        region: instance.region,
      },
      timeToFirstUserActivity,
    );
  }

  updateClusterMetrics(clusters: WorkspaceClusterWoTLS[]): void {
    let newActiveClusterNames: string[] = [];
    clusters.forEach((cluster) => {
      this.clusterCordoned.labels(cluster.name).set(cluster.state === 'cordoned' ? 1 : 0);
      this.clusterScore.labels(cluster.name).set(cluster.score);
      newActiveClusterNames.push(cluster.name);
    });

    const noLongerActiveCluster = this.activeClusterNames.filter((c) => !newActiveClusterNames.includes(c));
    if (noLongerActiveCluster.length > 0) {
      this.clusterScore.remove(...noLongerActiveCluster);
      this.clusterCordoned.remove(...noLongerActiveCluster);
    }
    this.activeClusterNames = newActiveClusterNames;
  }

  statusUpdateReceived(installation: string, knownInstance: boolean): void {
    this.statusUpdatesTotal.labels(installation, knownInstance ? 'true' : 'false').inc();
  }
}
