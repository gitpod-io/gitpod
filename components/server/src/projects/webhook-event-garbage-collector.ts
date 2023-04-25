/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import * as opentracing from "opentracing";
import { DBWithTracing, TracedWorkspaceDB, WorkspaceDB, WebhookEventDB } from "@gitpod/gitpod-db/lib";
import { Disposable } from "@gitpod/gitpod-protocol";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { repeat } from "@gitpod/gitpod-protocol/lib/util/repeat";
import { RedisMutex } from "../mutex/redlock";
import { ResourceLockedError } from "redlock";

@injectable()
export class WebhookEventGarbageCollector {
    static readonly GC_CYCLE_INTERVAL_SECONDS = 4 * 60; // every 6 minutes

    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;
    @inject(WebhookEventDB) protected readonly db: WebhookEventDB;

    @inject(RedisMutex) protected readonly mutex: RedisMutex;

    public async start(intervalSeconds?: number): Promise<Disposable> {
        const intervalSecs = intervalSeconds || WebhookEventGarbageCollector.GC_CYCLE_INTERVAL_SECONDS;
        return repeat(async () => {
            try {
                await this.mutex.client().using(["workspace-gc"], 30 * 1000, async (signal) => {
                    log.info("webhook-event-gc: acquired workspace-gc lock. Collecting old workspaces");
                    try {
                        await this.collectObsoleteWebhookEvents();
                    } catch (err) {
                        log.error("webhook-event-gc: failed to collect obsolte events", err);
                    }
                });
            } catch (err) {
                if (err instanceof ResourceLockedError) {
                    log.info(
                        "webhook-event-gc: failed to acquire workspace-gc lock, another instance already has the lock",
                        err,
                    );
                    return;
                }

                log.error("webhookgc: failed to acquire workspace-gc lock", err);
            }
        }, intervalSecs * 1000);
    }

    protected async collectObsoleteWebhookEvents() {
        const span = opentracing.globalTracer().startSpan("collectObsoleteWebhookEvents");
        log.debug("webhook-event-gc: start collecting...");
        try {
            await this.db.deleteOldEvents(10 /* days */, 600 /* limit per run */);
            log.debug("webhook-event-gc: done collecting.");
        } catch (err) {
            TraceContext.setError({ span }, err);
            log.error("webhook-event-gc: error collecting webhook events: ", err);
            throw err;
        } finally {
            span.finish();
        }
    }
}
