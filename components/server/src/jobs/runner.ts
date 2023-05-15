/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DisposableCollection } from "@gitpod/gitpod-protocol";
import { repeat } from "@gitpod/gitpod-protocol/lib/util/repeat";
import { inject, injectable } from "inversify";
import { RedisMutex } from "../redis/mutex";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { ResourceLockedError } from "redlock";
import { jobsDurationSeconds, reportJobCompleted, reportJobStarted } from "../prometheus-metrics";
import { DatabaseGarbageCollector } from "./database-gc";
import { OTSGarbageCollector } from "./ots-gc";
import { TokenGarbageCollector } from "./token-gc";
import { WebhookEventGarbageCollector } from "./webhook-gc";
import { WorkspaceGarbageCollector } from "./workspace-gc";
import { FixStripeAttributionIds } from "./fix-stripe-job";

export const Job = Symbol("Job");

export interface Job {
    get name(): string;
    get lockId(): string[];
    get frequencyMs(): number;
    run: () => Promise<void>;
}

@injectable()
export class JobRunner {
    @inject(RedisMutex) protected mutex: RedisMutex;

    @inject(DatabaseGarbageCollector) protected databaseGC: DatabaseGarbageCollector;
    @inject(OTSGarbageCollector) protected otsGC: OTSGarbageCollector;
    @inject(TokenGarbageCollector) protected tokenGC: TokenGarbageCollector;
    @inject(WebhookEventGarbageCollector) protected webhookGC: WebhookEventGarbageCollector;
    @inject(WorkspaceGarbageCollector) protected workspaceGC: WorkspaceGarbageCollector;
    @inject(FixStripeAttributionIds) protected fixStripeAttributionIds: FixStripeAttributionIds;

    public start(): DisposableCollection {
        const disposables = new DisposableCollection();

        const jobs: Job[] = [
            this.databaseGC,
            this.otsGC,
            this.tokenGC,
            this.webhookGC,
            this.workspaceGC,
            this.fixStripeAttributionIds,
        ];

        for (let job of jobs) {
            log.info(`Registered job ${job.name} in job runner.`, {
                jobName: job.name,
                frequencyMs: job.frequencyMs,
                redisLockId: job.lockId,
            });
            disposables.push(repeat(() => this.run(job), job.frequencyMs));
        }

        return disposables;
    }

    private async run(job: Job): Promise<void> {
        const logCtx = {
            jobTickId: new Date().toISOString(),
            jobName: job.name,
            redisLockId: job.lockId,
            frequencyMs: job.frequencyMs,
        };

        try {
            await this.mutex.using(job.lockId, job.frequencyMs, async (signal) => {
                log.info(`Acquired lock for job ${job.name}.`, logCtx);
                const timer = jobsDurationSeconds.startTimer({ name: job.name });
                reportJobStarted(job.name);
                const now = new Date().getTime();
                try {
                    await job.run();
                    log.info(`Succesfully finished job ${job.name}`, {
                        ...logCtx,
                        jobTookSec: `${(new Date().getTime() - now) / 1000}s`,
                    });
                    reportJobCompleted(job.name, true);
                } catch (err) {
                    log.error(`Error while running job ${job.name}`, err, {
                        ...logCtx,
                        jobTookSec: `${(new Date().getTime() - now) / 1000}s`,
                    });
                    reportJobCompleted(job.name, false);
                } finally {
                    jobsDurationSeconds.observe(timer());
                }
            });
        } catch (err) {
            if (err instanceof ResourceLockedError) {
                log.debug(
                    `Failed to acquire lock for job ${job.name}. Likely another instance already holds the lock.`,
                    err,
                    logCtx,
                );
                return;
            }

            log.error(`Failed to acquire lock for job ${job.name}`, err, logCtx);
        }
    }
}
