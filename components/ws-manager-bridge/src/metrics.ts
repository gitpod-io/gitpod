/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as prom from "prom-client";
import { injectable } from "inversify";
import { WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { WorkspaceClusterWoTLS } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { WorkspaceType } from "@gitpod/ws-manager/lib/core_pb";

@injectable()
export class Metrics {
    protected readonly workspaceStartupTimeHistogram: prom.Histogram<string>;
    protected readonly timeToFirstUserActivityHistogram: prom.Histogram<string>;
    protected readonly clusterScore: prom.Gauge<string>;
    protected readonly clusterCordoned: prom.Gauge<string>;
    protected readonly statusUpdatesTotal: prom.Counter<string>;
    protected readonly staleStatusUpdatesTotal: prom.Counter<string>;
    protected readonly stalePrebuildEventsTotal: prom.Counter<string>;
    protected readonly prebuildsCompletedTotal: prom.Counter<string>;
    protected readonly instanceMarkedStoppedTotal: prom.Counter<string>;

    protected readonly workspaceInstanceUpdateStartedTotal: prom.Counter<string>;
    protected readonly workspaceInstanceUpdateCompletedSeconds: prom.Histogram<string>;

    protected readonly updatesPublishedTotal: prom.Counter<string>;

    protected activeClusterNames = new Set<string>();

    constructor() {
        this.workspaceStartupTimeHistogram = new prom.Histogram({
            name: "workspace_startup_time",
            help: "The time until a workspace instance is marked running",
            labelNames: ["neededImageBuild", "region"],
            buckets: prom.exponentialBuckets(2, 2, 10),
        });
        this.timeToFirstUserActivityHistogram = new prom.Histogram({
            name: "first_user_activity_time",
            help: "The time between a workspace is running and first user activity",
            labelNames: ["region"],
            buckets: prom.exponentialBuckets(2, 2, 10),
        });
        this.clusterScore = new prom.Gauge({
            name: "gitpod_ws_manager_bridge_cluster_score",
            help: "Score of the individual registered workspace cluster",
            labelNames: ["workspace_cluster"],
        });
        this.clusterCordoned = new prom.Gauge({
            name: "gitpod_ws_manager_bridge_cluster_cordoned",
            help: "Cordoned status of the individual registered workspace cluster",
            labelNames: ["workspace_cluster"],
        });
        this.statusUpdatesTotal = new prom.Counter({
            name: "gitpod_ws_manager_bridge_status_updates_total",
            help: "Total workspace status updates received",
            labelNames: ["workspace_cluster", "known_instance"],
        });
        this.staleStatusUpdatesTotal = new prom.Counter({
            name: "gitpod_ws_manager_bridge_stale_status_updates_total",
            help: "Total count of stale status updates received by workspace manager bridge",
        });
        this.stalePrebuildEventsTotal = new prom.Counter({
            name: "gitpod_ws_manager_bridge_stale_prebuild_events_total",
            help: "Total count of stale prebuild events received by workspace manager bridge",
        });

        this.workspaceInstanceUpdateStartedTotal = new prom.Counter({
            name: "gitpod_ws_manager_bridge_workspace_instance_update_started_total",
            help: "Total number of workspace instance updates that started processing",
            labelNames: ["workspace_cluster", "workspace_instance_type"],
        });

        this.workspaceInstanceUpdateCompletedSeconds = new prom.Histogram({
            name: "gitpod_ws_manager_bridge_workspace_instance_update_completed_seconds",
            help: "Histogram of completed workspace instance updates, by outcome",
            labelNames: ["workspace_cluster", "workspace_instance_type", "outcome"],
            buckets: prom.exponentialBuckets(0.05, 2, 8),
        });

        this.prebuildsCompletedTotal = new prom.Counter({
            name: "gitpod_prebuilds_completed_total",
            help: "Counter of total prebuilds ended.",
            labelNames: ["state"],
        });

        this.instanceMarkedStoppedTotal = new prom.Counter({
            name: "gitpod_ws_instances_marked_stopped_total",
            help: "Counter of total instances marked stopped by the ws-manager-bridge",
            labelNames: ["previous_phase"],
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
        const newActiveClusterNames = new Set<string>();
        clusters.forEach((cluster) => {
            this.clusterCordoned.labels(cluster.name).set(cluster.state === "cordoned" ? 1 : 0);
            this.clusterScore.labels(cluster.name).set(cluster.score);
            newActiveClusterNames.add(cluster.name);
        });

        const noLongerActiveCluster = Array.from(this.activeClusterNames).filter((c) => !newActiveClusterNames.has(c));
        noLongerActiveCluster.forEach((clusterName) => {
            this.clusterCordoned.remove(clusterName);
            this.clusterScore.remove(clusterName);
        });
        this.activeClusterNames = newActiveClusterNames;
    }

    statusUpdateReceived(installation: string, knownInstance: boolean): void {
        this.statusUpdatesTotal.labels(installation, knownInstance ? "true" : "false").inc();
    }

    recordStaleStatusUpdate(): void {
        this.staleStatusUpdatesTotal.inc();
    }

    recordStalePrebuildEvent(): void {
        this.stalePrebuildEventsTotal.inc();
    }

    reportWorkspaceInstanceUpdateStarted(workspaceCluster: string, type: WorkspaceType): void {
        this.workspaceInstanceUpdateStartedTotal.labels(workspaceCluster, WorkspaceType[type]).inc();
    }

    reportWorkspaceInstanceUpdateCompleted(
        durationSeconds: number,
        workspaceCluster: string,
        type: WorkspaceType,
        error?: Error,
    ): void {
        const outcome = error ? "error" : "success";
        this.workspaceInstanceUpdateCompletedSeconds
            .labels(workspaceCluster, WorkspaceType[type], outcome)
            .observe(durationSeconds);
    }

    increasePrebuildsCompletedCounter(state: string) {
        this.prebuildsCompletedTotal.inc({ state });
    }

    increaseInstanceMarkedStoppedCounter(previous_phase: string) {
        this.instanceMarkedStoppedTotal.inc({ previous_phase });
    }
}
