/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { User, PrebuiltWorkspace } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { WorkspaceDB, DBWithTracing, TracedWorkspaceDB } from "@gitpod/gitpod-db/lib";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { Config } from "../../../src/config";

@injectable()
export class PrebuildRateLimiter {
    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;
    @inject(Config) protected readonly config: Config;

    async canBuildNow(ctx: TraceContext, user: User | string, cloneURL: string): Promise<boolean> {
        const span = TraceContext.startSpan("canBuildNow", ctx);

        try {
            const runningPrebuildCount = await this.workspaceDB.trace({span}).countRunningPrebuilds(cloneURL);
            span.log({runningPrebuildCount, cloneURL});
            if (runningPrebuildCount >= this.config.maxConcurrentPrebuildsPerRef) {
                return false;
            }
        } catch(e) {
            TraceContext.logError({span}, e);
            throw e;
        } finally {
            span.finish();
        }

        return true;
    }

    async shouldStillBuild(ctx: TraceContext, pws: PrebuiltWorkspace) {
        return true;
    }

}