/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import * as opentracing from "opentracing";
import { UserDB, DBWithTracing, TracedWorkspaceDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Job } from "./runner";

@injectable()
export class TokenGarbageCollector implements Job {
    static readonly GC_CYCLE_INTERVAL_SECONDS = 5 * 60;

    @inject(UserDB) protected readonly userDb: UserDB;

    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;

    public name = "token-gc";
    public frequencyMs = 5 * 60 * 1000; // every 5 minutes

    public async run(): Promise<number | undefined> {
        const span = opentracing.globalTracer().startSpan("collectExpiredTokenEntries");
        log.debug("token-gc: start collecting...");
        try {
            await this.userDb.deleteExpiredTokenEntries(new Date().toISOString());
            log.debug("token-gc: done collecting.");

            return undefined;
        } catch (err) {
            TraceContext.setError({ span }, err);
            log.error("token-gc: error collecting expired tokens: ", err);
            throw err;
        } finally {
            span.finish();
        }
    }
}
