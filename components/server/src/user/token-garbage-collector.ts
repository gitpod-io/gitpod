/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import * as opentracing from "opentracing";
import { UserDB, DBWithTracing, TracedWorkspaceDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { Disposable } from "@gitpod/gitpod-protocol";
import { ConsensusLeaderQorum } from "../consensus/consensus-leader-quorum";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { repeat } from "@gitpod/gitpod-protocol/lib/util/repeat";
import { RedisMutex } from "../mutex/redlock";
import { ResourceLockedError } from "redlock";

@injectable()
export class TokenGarbageCollector {
    static readonly GC_CYCLE_INTERVAL_SECONDS = 5 * 60;

    @inject(UserDB) protected readonly userDb: UserDB;

    @inject(RedisMutex) protected readonly mutex: RedisMutex;
    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;

    public async start(intervalSeconds?: number): Promise<Disposable> {
        const intervalSecs = intervalSeconds || TokenGarbageCollector.GC_CYCLE_INTERVAL_SECONDS;
        return repeat(async () => {
            try {
                await this.mutex.client().using(["token-gc"], 10 * 1000, async (signal) => {
                    try {
                        await this.collectExpiredTokenEntries();
                    } catch (err) {
                        log.error("tokengc: failed to expire token entries", err);
                    }
                });
            } catch (err) {
                if (err instanceof ResourceLockedError) {
                    log.info("tokengc: failed to acquire token-gc lock, another instance already has the lock", err);
                    return;
                }

                log.error("tokengc: failed to acquire workspace-gc lock", err);
            }
        }, intervalSecs * 1000);
    }

    protected async collectExpiredTokenEntries() {
        const span = opentracing.globalTracer().startSpan("collectExpiredTokenEntries");
        log.debug("tokengc: start collecting...");
        try {
            await this.userDb.deleteExpiredTokenEntries(new Date().toISOString());
            log.debug("tokengc: done collecting.");
        } catch (err) {
            TraceContext.setError({ span }, err);
            log.error("tokengc: error collecting expired tokens: ", err);
            throw err;
        } finally {
            span.finish();
        }
    }
}
