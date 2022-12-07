/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as prometheusClient from "prom-client";

export function registerDBMetrics(registry: prometheusClient.Registry) {
    registry.registerMetric(workspacesPurgedTotal);
    registry.registerMetric(prebuildWorkspacesPurgedTotal);
    registry.registerMetric(prebuildInfoPurgedTotal);
    registry.registerMetric(workspaceInstancePurgedTotal);
}

const workspacesPurgedTotal = new prometheusClient.Counter({
    name: "gitpod_server_workspaces_purged_total",
    help: "Counter of workspaces hard deleted by periodic gc.",
});

export function reportWorkspacePurged(count: number) {
    workspacesPurgedTotal.inc(count);
}

const prebuildWorkspacesPurgedTotal = new prometheusClient.Counter({
    name: "gitpod_server_prebuild_workspaces_purged_total",
    help: "Counter of prebuild workspaces hard deleted by periodic gc.",
});

export function reportPrebuiltWorkspacePurged(count: number) {
    prebuildWorkspacesPurgedTotal.inc(count);
}

const prebuildInfoPurgedTotal = new prometheusClient.Counter({
    name: "gitpod_server_prebuild_info_purged_total",
    help: "Counter of prebuild info records hard deleted by periodic gc.",
});

export function reportPrebuildInfoPurged(count: number) {
    prebuildInfoPurgedTotal.inc(count);
}

const workspaceInstancePurgedTotal = new prometheusClient.Counter({
    name: "gitpod_server_workspace_instances_purged_total",
    help: "Counter of workspace instances records hard deleted by periodic gc.",
});

export function reportWorkspaceInstancePurged(count: number) {
    workspaceInstancePurgedTotal.inc(count);
}

const prebuiltWorkspaceUpdatablePurgedTotal = new prometheusClient.Counter({
    name: "gitpod_server_prebuilt_workspace_updatable_purged_total",
    help: "Counter of prebuilt workspace updatable records hard deleted by periodic gc.",
});

export function reportPrebuiltWorkspaceUpdatablePurged(count: number) {
    prebuiltWorkspaceUpdatablePurgedTotal.inc(count);
}
