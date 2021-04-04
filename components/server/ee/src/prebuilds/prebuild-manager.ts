/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { DBWithTracing, TracedWorkspaceDB } from '@gitpod/gitpod-db/lib/traced-db';
import { WorkspaceDB } from '@gitpod/gitpod-db/lib/workspace-db';
import { CommitContext, StartPrebuildContext, User, WorkspaceConfig, WorkspaceInstance } from '@gitpod/gitpod-protocol';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { inject, injectable } from 'inversify';
import { URL } from 'url';
import { HostContextProvider } from '../../../src/auth/host-context-provider';
import { StartPrebuildResult } from './github-app';
import { WorkspaceFactory } from '../../../src/workspace/workspace-factory';
import { ConfigProvider } from '../../../src/workspace/config-provider';
import { WorkspaceStarter } from '../../../src/workspace/workspace-starter';

export class WorkspaceRunningError extends Error {
    constructor(msg: string, public instance: WorkspaceInstance) {
        super(msg);
    }
}

@injectable()
export class PrebuildManager {
    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;
    @inject(WorkspaceFactory) protected readonly workspaceFactory: WorkspaceFactory;
    @inject(WorkspaceStarter) protected readonly workspaceStarter: WorkspaceStarter;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(ConfigProvider) protected readonly configProvider: ConfigProvider;

    async hasAutomatedPrebuilds(ctx: TraceContext, cloneURL: string): Promise<boolean> {
        const span = TraceContext.startSpan("hasPrebuilds", ctx);
        span.setTag(cloneURL, cloneURL);
        try {
            const existingPBs = await this.workspaceDB.trace({ span }).findPrebuildsWithWorkpace(cloneURL);
            for (const pb of existingPBs) {
                if (!pb.workspace.contextURL.startsWith('prebuild')) {
                    return true;
                }
            }
            return false;
        } catch (err) {
            TraceContext.logError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    async startPrebuild(ctx: TraceContext, user: User, contextURL: string, cloneURL: string, commit: string): Promise<StartPrebuildResult> {
        const span = TraceContext.startSpan("startPrebuild", ctx);
        span.setTag("contextURL", contextURL);
        span.setTag("cloneURL", cloneURL);
        span.setTag("commit", commit);
        try {
            const existingPB = await this.workspaceDB.trace({ span }).findPrebuiltWorkspaceByCommit(cloneURL, commit);
            if (!!existingPB) {
                return { wsid: existingPB.buildWorkspaceId, done: true, didFinish: existingPB.state === 'available' };
            }

            const contextParser = this.getContextParserFor(contextURL);
            if (!contextParser) {
                throw new Error(`Cannot find context parser for URL: ${contextURL}`);
            }
            const actual = await contextParser.handle({ span }, user, contextURL) as CommitContext;
            actual.revision = commit;  // Make sure we target the correct commit here (might have changed between trigger and contextParser lookup)
            actual.ref = undefined;
            actual.forceCreateNewWorkspace = true;

            const prebuildContext: StartPrebuildContext = {
                title: `Prebuild of "${actual.title}"`,
                actual
            };

            log.debug("Created prebuild context", prebuildContext);

            const workspace = await this.workspaceFactory.createForContext({span}, user, prebuildContext, contextURL);

            // const canBuildNow = await this.prebuildRateLimiter.canBuildNow({ span }, user, cloneURL);
            // if (!canBuildNow) {
            //     // we cannot start building now because the rate limiter prevents it.
            //     span.setTag("starting", false);
            //     return { wsid: workspace.id, done: false };;
            // }

            span.setTag("starting", true);
            await this.workspaceStarter.startWorkspace({ span }, workspace, user);
            return { wsid: workspace.id, done: false };
        } catch (err) {
            TraceContext.logError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    async retriggerPrebuild(ctx: TraceContext, user: User, workspaceId: string): Promise<StartPrebuildResult> {
        const span = TraceContext.startSpan("retriggerPrebuild", ctx);
        span.setTag("workspaceId", workspaceId);
        try {
            const runningInstance = await this.workspaceDB.trace({ span }).findRunningInstance(workspaceId);
            if (runningInstance !== undefined) {
                throw new WorkspaceRunningError('Workspace is still runnning', runningInstance);
            }
            span.setTag("starting", true);
            const workspace = await this.workspaceDB.trace({ span }).findById(workspaceId);
            if (!workspace) {
                console.error('Unknown workspace id.', { workspaceId });
                throw new Error('Unknown workspace ' + workspaceId);
            }
            await this.workspaceStarter.startWorkspace({ span }, workspace, user);
            return { wsid: workspace.id, done: false };
        } catch (err) {
            TraceContext.logError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    shouldPrebuild(config: WorkspaceConfig | undefined): boolean {
        if (!config ||
            !config._origin ||
            config._origin !== 'repo') {
            // we demand an explicit gitpod config
            return false;
        }

        const hasPrebuildTask = !!config.tasks && config.tasks.find(t => !!t.init || !!t.prebuild);
        if (!hasPrebuildTask) {
            return false;
        }

        return true;
    }

    async fetchConfig(ctx: TraceContext, user: User, contextURL: string): Promise<WorkspaceConfig | undefined> {
        const span = TraceContext.startSpan("fetchConfig", ctx);
        span.setTag("contextURL", contextURL);

        try {
            const contextParser = this.getContextParserFor(contextURL);
            if (!contextParser) {
                return undefined;
            }
            const context = await contextParser!.handle({ span }, user, contextURL);
            return await this.configProvider.fetchConfig({ span }, user, context as CommitContext);
        } catch (err) {
            TraceContext.logError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    protected getContextParserFor(contextURL: string) {
        const host = new URL(contextURL).hostname;
        const hostContext = this.hostContextProvider.get(host);
        if (!hostContext) {
            return undefined;
        }
        return hostContext.contextParser;
    }
}