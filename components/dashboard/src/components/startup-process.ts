/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceInstancePhase } from "@gitpod/gitpod-protocol";

const ShortTime = 500;

export interface StageDescription {
    order: number;
    label: string;
    expectedTime?: number;
    absoluteStartTime?: number;
    appendNumber?: boolean;
}

export type StartupProcessKey = 'preparing' | 'unknown' | 'pending' | 'creating' | 'initializing' | 'restoring-prebuild' | 'running' | 'stopping' | 'stopped';

export class StartupProcess {
    public stages: { [key in StartupProcessKey]: StageDescription } = {
        // Preparing is a special animal: if we're really building the image, things
        // take way longer and we need exceptional handling of the startup process. Normally, we
        // should not have to build an image and just check for its presence. That one's fast.
        'preparing': {
            order: 1,
            label: 'Building Workspace Image',
            appendNumber: true,
            expectedTime: 0
        },
        'unknown': {
            order: 2,
            label: 'Booting up',
            appendNumber: true,
            expectedTime: ShortTime
        },
        'pending': {
            order: 3,
            label: 'Acquiring Node',
            appendNumber: true,
            expectedTime: 2 * 1000,
        },
        'creating': {
            order: 4,
            label: 'Pulling Docker Images',
            appendNumber: true,
            expectedTime: 4 * 1000
        },
        'initializing': {
            order: 6,
            label: 'Initializing Workspace',
            appendNumber: true,
            expectedTime: 8 * 1000
        },
        'restoring-prebuild': {
            order: 7,
            label: 'Loading Prebuild',
            appendNumber: true,
            expectedTime: 0
        },
        'running': {
            order: 0,
            label: 'Running'
        },
        'stopping': {
            order: 0,
            label: 'Stopping'
        },
        'stopped': {
            order: 0,
            label: 'Stopped'
        },
    };

    protected time = 0;
    protected running: boolean;

    constructor(protected onUpdate: (progress: number) => void) {
    }

    public startProcess(customStageDesc?: { [key: string]: StageDescription }) {
        if (this.running) {
            return;
        }
        this.running = true;

        const sortedStages = Object.keys(this.stages).map(k => this.stages[k]).filter(s => !!s.order).sort((a, b) => a.order - b.order);
        const steps = sortedStages.reduce((m, e) => m.concat([(m[m.length - 1] || 0) + (e.expectedTime || 0)]), [] as number[]);
        sortedStages[0].absoluteStartTime = 0;
        for (var i = 1; i < steps.length; i++) {
            sortedStages[i].absoluteStartTime = steps[i - 1];
        }
        const totalExpectedTime = steps[steps.length - 1];

        /* Tau is the time constant of the exponential process which models the workspace startup.
         * We give this time constant with respect to the total expected time. The higher tauFraction
         * is, the further the progressbar will have progressed after the totalExpectedTime. The progress
         * at totalExpectedTime is p_totalExpectedTime = 1.0 - exp(-tauFraction)
         */
        const tauFraction = 4;
        const tau = totalExpectedTime / tauFraction;
        const samplingPeriod = 50;

        setInterval(() => this.update(samplingPeriod, tau), samplingPeriod);
    }

    protected update(samplingPeriod: number, tau: number) {
        if (isNaN(this.time)) {
            this.time = 0;
        }
        this.time += samplingPeriod;
        const progress = 1.0 - Math.exp(-1 * this.time / tau);
        this.onUpdate(progress);
    }

    public setStage(stage: WorkspaceInstancePhase | 'restoring-prebuild') {
        const info = this.stages[stage];
        if (info && info.absoluteStartTime !== undefined) {
            this.time = Math.max(this.time, info.absoluteStartTime);
        }
    }

    public getLabel(stage: WorkspaceInstancePhase | 'restoring-prebuild') {
        const info = this.stages[stage];
        if (info) {
            let result = info.label;
            if (info.appendNumber) {
                const sortedStages = Object.keys(this.stages).map(k => {return {k, v: this.stages[k]}}).filter(s => !!s.v.order && !!s.v.expectedTime).sort((a, b) => a.v.order - b.v.order);
                const idx = sortedStages.findIndex(s => s.k === stage);
                if (idx > -1) {
                    result += ` ... (${idx}/${sortedStages.length - 1})`;
                }
            }
            return result;
        } else {
            return 'Unknown';
        }
    }

}