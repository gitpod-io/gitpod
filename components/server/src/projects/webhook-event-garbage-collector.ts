/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import * as opentracing from "opentracing";
import { DBWithTracing, TracedWorkspaceDB, WorkspaceDB, WebhookEventDB } from "@gitpod/gitpod-db/lib";
import { Disposable } from "@gitpod/gitpod-protocol";
import { ConsensusLeaderQorum } from "../consensus/consensus-leader-quorum";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { repeat } from "@gitpod/gitpod-protocol/lib/util/repeat";

@injectable()
export class WebhookEventGarbageCollector {
    static readonly GC_CYCLE_INTERVAL_SECONDS = 4 * 60; // every 6 minutes

    @inject(WebhookEventDB) protected readonly db: WebhookEventDB;

    @inject(ConsensusLeaderQorum) protected readonly leaderQuorum: ConsensusLeaderQorum;
    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;

    public async start(intervalSeconds?: number): Promise<Disposable> {
        const intervalSecs = intervalSeconds || WebhookEventGarbageCollector.GC_CYCLE_INTERVAL_SECONDS;
        return repeat(async () => {
            try {
                if (await this.leaderQuorum.areWeLeader()) {
                    await this.collectObsoleteWebhookEvents();
                }
            } catch (err) {
                log.error("webhook event garbage collector", err);
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
