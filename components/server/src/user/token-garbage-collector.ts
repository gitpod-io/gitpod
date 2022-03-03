/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';
import * as opentracing from 'opentracing';
import { UserDB, DBWithTracing, TracedWorkspaceDB, WorkspaceDB } from '@gitpod/gitpod-db/lib';
import { Disposable } from '@gitpod/gitpod-protocol';
import { ConsensusLeaderQorum } from '../consensus/consensus-leader-quorum';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { repeat } from '@gitpod/gitpod-protocol/lib/util/repeat';

@injectable()
export class TokenGarbageCollector {
    static readonly GC_CYCLE_INTERVAL_SECONDS = 5 * 60;

    @inject(UserDB) protected readonly userDb: UserDB;

    @inject(ConsensusLeaderQorum) protected readonly leaderQuorum: ConsensusLeaderQorum;
    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;

    public async start(intervalSeconds?: number): Promise<Disposable> {
        const intervalSecs = intervalSeconds || TokenGarbageCollector.GC_CYCLE_INTERVAL_SECONDS;
        return repeat(async () => {
            try {
                if (await this.leaderQuorum.areWeLeader()) {
                    await this.collectExpiredTokenEntries();
                }
            } catch (err) {
                log.error('token garbage collector', err);
            }
        }, intervalSecs * 1000);
    }

    protected async collectExpiredTokenEntries() {
        const span = opentracing.globalTracer().startSpan('collectExpiredTokenEntries');
        log.debug('tokengc: start collecting...');
        try {
            await this.userDb.deleteExpiredTokenEntries(new Date().toISOString());
            log.debug('tokengc: done collecting.');
        } catch (err) {
            TraceContext.setError({ span }, err);
            log.error('tokengc: error collecting expired tokens: ', err);
            throw err;
        } finally {
            span.finish();
        }
    }
}
