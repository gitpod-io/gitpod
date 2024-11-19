/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import * as opentracing from "opentracing";
import { DBWithTracing, TracedWorkspaceDB, WorkspaceDB, WebhookEventDB } from "@gitpod/gitpod-db/lib";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Job } from "./runner";

@injectable()
export class WebhookEventGarbageCollector implements Job {
    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;
    @inject(WebhookEventDB) protected readonly db: WebhookEventDB;

    public name = "webhook-gc";
    public frequencyMs = 4 * 60 * 1000; // every 4 minutes

    public async run(): Promise<number | undefined> {
        const span = opentracing.globalTracer().startSpan("collectObsoleteWebhookEvents");
        log.debug("webhook-event-gc: start collecting...");

        try {
            await this.db.deleteOldEvents(10 /* days */, 600 /* limit per run */);
            log.debug("webhook-event-gc: done collecting.");

            return undefined;
        } catch (err) {
            TraceContext.setError({ span }, err);
            log.error("webhook-event-gc: error collecting webhook events: ", err);
            throw err;
        } finally {
            span.finish();
        }
    }
}
