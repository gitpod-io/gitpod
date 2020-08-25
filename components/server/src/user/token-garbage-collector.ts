/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import * as opentracing from 'opentracing';
import { UserDB } from "@gitpod/gitpod-db/lib/user-db";
import { DBWithTracing, TracedWorkspaceDB } from "@gitpod/gitpod-db/lib/traced-db";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { Disposable } from "@gitpod/gitpod-protocol";
import { ConsensusLeaderQorum } from "../consensus/consensus-leader-quorum";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class TokenGarbageCollector {
    static readonly GC_CYCLE_INTERVAL_SECONDS = 5 * 60;

    @inject(UserDB) protected readonly userDb: UserDB;

    @inject(ConsensusLeaderQorum) protected readonly leaderQuorum: ConsensusLeaderQorum;
    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;

    public async start(intervalSeconds?: number): Promise<Disposable> {
        const intervalSecs = (intervalSeconds || TokenGarbageCollector.GC_CYCLE_INTERVAL_SECONDS);
        const timer = setInterval(async () => {
            try {
                if (await this.leaderQuorum.areWeLeader()) {
                    await this.collectExpiredTokenEntries();
                }
            } catch (err) {
                log.error("token garbage collector", err);
            }
        }, intervalSecs * 1000);
        return {
            dispose: () => clearInterval(timer)
        }
    }

    protected async collectExpiredTokenEntries() {
        const span = opentracing.globalTracer().startSpan("collectExpiredTokenEntries");
        log.debug("tokengc: start collecting...");
        try {
            await this.userDb.deleteExpiredTokenEntries(new Date().toISOString());
            log.debug("tokengc: done collecting.");
        } catch (err) {
            TraceContext.logError({ span }, err);
            log.error("tokengc: error collecting expired tokens: ", err);
            throw err;
        } finally {
            span.finish();
        }
    }
}