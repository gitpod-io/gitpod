/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as prom from 'prom-client';
import { injectable } from "inversify";
import { WorkspaceInstance } from '@gitpod/gitpod-protocol';

@injectable()
export class PrometheusMetricsExporter {
    protected readonly workspaceStartupTimeHistogram: prom.Histogram<string>;
    protected readonly timeToFirstUserActivityHistogram: prom.Histogram<string>;

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
    }

    observeWorkspaceStartupTime(instance: WorkspaceInstance): void {
        const timeToRunningSecs = (new Date(instance.startedTime!).getTime() - new Date(instance.creationTime).getTime()) / 1000;
        this.workspaceStartupTimeHistogram.observe({
            neededImageBuild: JSON.stringify(instance.status.conditions.neededImageBuild),
            region: instance.region,
        }, timeToRunningSecs);
    }

    observeFirstUserActivity(instance: WorkspaceInstance, firstUserActivity: string): void {
        if (!instance.startedTime) {
            return;
        }

        const timeToFirstUserActivity = (new Date(firstUserActivity).getTime() - new Date(instance.startedTime!).getTime()) / 1000;
        this.timeToFirstUserActivityHistogram.observe({
            region: instance.region,
        }, timeToFirstUserActivity);
    }
}