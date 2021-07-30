/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";

export const IClientDataPrometheusAdapter = Symbol('IClientDataPrometheusAdapter');
export interface IClientDataPrometheusAdapter {
    storeWorkspaceRoundTripTimeSample(time: Date, user: User, workspaceId: string, roundTripTimeInMilliseconds: number): void;
    storePrebuildQueueLength(time: Date, cloneURL: string, queueLength: number): void;
}

import * as prom from 'prom-client';
import { injectable, inject } from "inversify";
import { Config } from "../config";

@injectable()
export class ClientDataPrometheusAdapterImpl implements IClientDataPrometheusAdapter {
    @inject(Config) protected readonly config: Config;
    protected readonly roundTripTimeGauge: prom.Gauge;
    protected readonly prebuildQueueSizeGauge: prom.Gauge;

    constructor() {
        this.roundTripTimeGauge = new prom.Gauge({
            name: 'workspace_round_trip_time',
            help: 'The round-trip time of our users with respect to their workspace instance.',
            labelNames: ['user', 'workspace', 'region']
        });
        this.prebuildQueueSizeGauge = new prom.Gauge({
            name: 'prebuild_queue_size',
            help: 'The amount of prebuilds waiting to run',
            labelNames: ['cloneURL', 'region']
        })
    }

    storeWorkspaceRoundTripTimeSample(time: Date, user: User, workspaceId: string, roundTripTimeInMilliseconds: number): void {
        this.roundTripTimeGauge.set({ user: user.id, workspace: workspaceId, region: this.config.installationShortname }, roundTripTimeInMilliseconds, time);
    }

    storePrebuildQueueLength(time: Date, cloneURL: string, queueLength: number): void {
        this.prebuildQueueSizeGauge.set({ cloneURL, region: this.config.installationShortname }, queueLength, time);
    }

}