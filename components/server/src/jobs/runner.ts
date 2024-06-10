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
import { jobsDurationSeconds, reportJobCompleted, reportJobStarted } from "../prometheus-metrics";
import { DatabaseGarbageCollector } from "./database-gc";
import { OTSGarbageCollector } from "./ots-gc";
import { TokenGarbageCollector } from "./token-gc";
import { WebhookEventGarbageCollector } from "./webhook-gc";
import { WorkspaceGarbageCollector } from "./workspace-gc";
import { SnapshotsJob } from "./snapshots";
import { RelationshipUpdateJob } from "../authorization/relationship-updater-job";
import { WorkspaceStartController } from "../workspace/workspace-start-controller";
import { runWithRequestContext } from "../util/request-context";
import { SYSTEM_USER } from "../authorization/authorizer";
import { InstallationAdminCleanup } from "./installation-admin-cleanup";
import { CapGitStatus } from "./cap-git-status";
import { CapStatus } from "./cap-status";

export const Job = Symbol("Job");

export interface Job {
    readonly name: string;
    readonly frequencyMs: number;
    readonly lockedResources?: string[];
    run: () => Promise<number | undefined>;
}

@injectable()
export class JobRunner {
    constructor(
        @inject(RedisMutex) private readonly mutex: RedisMutex,
        @inject(DatabaseGarbageCollector) private readonly databaseGC: DatabaseGarbageCollector,
        @inject(OTSGarbageCollector) private readonly otsGC: OTSGarbageCollector,
        @inject(TokenGarbageCollector) private readonly tokenGC: TokenGarbageCollector,
        @inject(WebhookEventGarbageCollector) private readonly webhookGC: WebhookEventGarbageCollector,
        @inject(WorkspaceGarbageCollector) private readonly workspaceGC: WorkspaceGarbageCollector,
        @inject(SnapshotsJob) private readonly snapshotsJob: SnapshotsJob,
        @inject(RelationshipUpdateJob) private readonly relationshipUpdateJob: RelationshipUpdateJob,
        @inject(WorkspaceStartController) private readonly workspaceStartController: WorkspaceStartController,
        @inject(InstallationAdminCleanup) private readonly installationAdminCleanup: InstallationAdminCleanup,
        @inject(CapGitStatus) private readonly capGitStatus: CapGitStatus,
        @inject(CapStatus) private readonly capStatus: CapStatus,
    ) {}

    public start(): DisposableCollection {
        const disposables = new DisposableCollection();

        const jobs: Job[] = [
            this.databaseGC,
            this.otsGC,
            this.tokenGC,
            this.webhookGC,
            this.workspaceGC,
            this.snapshotsJob,
            this.relationshipUpdateJob,
            this.workspaceStartController,
            this.installationAdminCleanup,
            this.capGitStatus,
            this.capStatus,
        ];

        for (const job of jobs) {
            log.info(`Registered job ${job.name} in job runner.`, {
                jobName: job.name,
                frequencyMs: job.frequencyMs,
                lockedResources: job.lockedResources,
            });
            // immediately run the job once
            this.run(job).catch((err) => log.error(`Error while running job ${job.name}`, err));
            disposables.push(repeat(() => this.run(job), job.frequencyMs));
        }

        return disposables;
    }

    private async run(job: Job): Promise<void> {
        const logCtx = {
            jobTickId: new Date().toISOString(),
            jobName: job.name,
            lockedResources: job.lockedResources,
            frequencyMs: job.frequencyMs,
        };

        try {
            await this.mutex.using([job.name, ...(job.lockedResources || [])], job.frequencyMs, async (signal) => {
                const ctx = {
                    signal,
                    requestKind: "job",
                    requestMethod: job.name,
                    subjectId: SYSTEM_USER,
                };
                await runWithRequestContext(ctx, async () => {
                    log.debug(`Acquired lock for job ${job.name}.`, logCtx);
                    // we want to hold the lock for the entire duration of the job, so we return earliest after frequencyMs
                    const timeout = new Promise<void>((resolve) => setTimeout(resolve, job.frequencyMs));
                    const timer = jobsDurationSeconds.startTimer({ name: job.name });
                    reportJobStarted(job.name);
                    const now = new Date().getTime();
                    try {
                        const unitsOfWork = await job.run();
                        log.debug(`Successfully finished job ${job.name}`, {
                            ...logCtx,
                            jobTookSec: `${(new Date().getTime() - now) / 1000}s`,
                        });
                        reportJobCompleted(job.name, true, unitsOfWork);
                    } catch (err) {
                        log.error(`Error while running job ${job.name}`, err, {
                            ...logCtx,
                            jobTookSec: `${(new Date().getTime() - now) / 1000}s`,
                        });
                        reportJobCompleted(job.name, false);
                    } finally {
                        jobsDurationSeconds.observe(timer());
                        await timeout;
                    }
                });
            });
        } catch (err) {
            if (RedisMutex.isLockedError(err)) {
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
