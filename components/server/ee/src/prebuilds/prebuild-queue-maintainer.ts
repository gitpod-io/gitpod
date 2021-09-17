/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { inject, injectable } from "inversify";
import { TracedWorkspaceDB, DBWithTracing, TracedUserDB, UserDB, WorkspaceDB } from '@gitpod/gitpod-db/lib';
import { MessageBusIntegration } from "../../../src/workspace/messagebus-integration";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { HeadlessWorkspaceEvent, HeadlessWorkspaceEventType } from "@gitpod/gitpod-protocol/lib/headless-workspace-log";
import { Disposable, PrebuiltWorkspace } from "@gitpod/gitpod-protocol";
import { PrebuildRateLimiter } from "./prebuild-rate-limiter";
import { WorkspaceStarter } from "../../../src/workspace/workspace-starter";
import { IClientDataPrometheusAdapter } from "../../../src/workspace/client-data-prometheus-adapter";
import { ConsensusLeaderQorum } from "../../../src/consensus/consensus-leader-quorum";

@injectable()
export class PrebuildQueueMaintainer implements Disposable {
    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;
    @inject(TracedUserDB) protected readonly userDB: DBWithTracing<UserDB>;
    @inject(MessageBusIntegration) protected readonly messagebus: MessageBusIntegration;
    @inject(WorkspaceStarter) protected readonly workspaceStarter: WorkspaceStarter;
    @inject(PrebuildRateLimiter) protected readonly prebuildRateLimiter: PrebuildRateLimiter;

    @inject(ConsensusLeaderQorum) protected readonly qorum: ConsensusLeaderQorum;

    @inject(IClientDataPrometheusAdapter) protected readonly prometheusAdapter: IClientDataPrometheusAdapter;

    protected messagebusListener?: Disposable;
    protected periodicMaintainer?: NodeJS.Timer;

    start(): void {
        this.messagebusListener = this.messagebus.listenForPrebuildUpdatableQueue((ctx, msg) => this.handlePrebuildFinished(ctx, msg));
        this.periodicMaintainer = setInterval(this.periodicQueueMaintainance.bind(this), 60 * 1000) as any as NodeJS.Timer;
        log.debug("prebuild queue maintainer started");
    }

    protected async handlePrebuildFinished(ctx: TraceContext, msg: HeadlessWorkspaceEvent) {
        const span = TraceContext.startSpan("PrebuildQueueMaintainer.handlePrebuildFinished", ctx)

        // in the following it's fine for us to just return/ignore missing parts as the periodic maintainance will eventually remove too old prebuilds.
        try {
            const prebuild = await this.workspaceDB.trace({span}).findPrebuildByWorkspaceID(msg.workspaceID);
            if (!prebuild) {
                return;
            }
            const workspace = await this.workspaceDB.trace({span}).findById(prebuild.buildWorkspaceId);
            if (!workspace) {
                return;
            }
            const user = await this.userDB.trace({span}).findUserById(workspace.ownerId);
            if (!user) {
                return;
            }
            const queuedPrebuilds = await this.workspaceDB.trace({span}).findQueuedPrebuilds(prebuild.cloneURL);
            if (queuedPrebuilds.length === 0) {
                return;
            }
            const canBuildNow = await this.prebuildRateLimiter.canBuildNow({ span }, user, prebuild.cloneURL);
            if (!canBuildNow) {
                return;
            }

            // we must only start new prebuilds if we're the currently leading server
            if (!(await this.qorum.areWeLeader())) {
                return;
            }

            // findQueuedPrebuilds orders by creation date (oldest first), thus the first element of this list is the prebuild waiting the longest.
            // We still loop here just in case some "broken" prebuild in the queue does not block the others.
            for (let i = 0; i < queuedPrebuilds.length; i++) {
                const { prebuild: nextPrebuild, workspace: nextWorkspace } = queuedPrebuilds[i];
                if (!(await this.prebuildRateLimiter.shouldStillBuild({span}, nextPrebuild))) {
                    await this.discardPrebuild({span}, nextPrebuild);
                    continue;
                }

                await this.workspaceStarter.startWorkspace({span}, nextWorkspace, user);
                break;
            }
        } catch (err) {
            TraceContext.logError({span}, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    protected async periodicQueueMaintainance() {
        const queuedPrebuilds = await this.workspaceDB.trace({}).findQueuedPrebuilds();
        if (!queuedPrebuilds || queuedPrebuilds.length == 0) {
            return;
        }

        // we must only start work on the prebuild queue if we're the currently leading server
        if (!(await this.qorum.areWeLeader())) {
            return;
        }

        // start span only if there are prebuilds to look at ... don't want to spam the trace logs
        const span = TraceContext.startSpan("PrebuildQueueMaintainer.periodicQueueMaintainance", {})
        span.log({queuedPrebuilds});
        try {
            const queueLengths = new Map<string, number>();
            const canBuildCache = new Map<string, boolean>();
            for (const {prebuild, workspace} of queuedPrebuilds) {

                if (!(await this.prebuildRateLimiter.shouldStillBuild({span}, prebuild))) {
                    await this.discardPrebuild({span}, prebuild);
                    continue;
                }

                queueLengths.set(prebuild.cloneURL, (queueLengths.get(prebuild.cloneURL) || 0) + 1);

                const userID = workspace.ownerId;
                let canBuild = canBuildCache.get(prebuild.cloneURL);
                if (canBuild === undefined) {
                    canBuild = await this.prebuildRateLimiter.canBuildNow({span}, userID, prebuild.cloneURL);
                    canBuildCache.set(prebuild.cloneURL, canBuild);
                }
                if (!canBuild) {
                    span.log({'rate-limited': prebuild.id});
                    continue;
                }

                const user = await this.userDB.trace({span}).findUserById(userID);
                if (!user) {
                    continue;
                }
                await this.workspaceStarter.startWorkspace({span}, workspace, user);
            }

            Array.from(queueLengths.keys()).forEach(q => this.prometheusAdapter.storePrebuildQueueLength(q, queueLengths.get(q) || 0));
        } catch (err) {
            TraceContext.logError({span}, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    protected async discardPrebuild(ctx: TraceContext, prebuild: PrebuiltWorkspace) {
        const span = TraceContext.startSpan("PrebuildQueueMaintainer.discardPrebuild", {})

        try {
            prebuild.state = 'aborted';
            this.workspaceDB.trace({span}).storePrebuiltWorkspace(prebuild);

            let userId: string;
            const workspace = await this.workspaceDB.trace({span}).findById(prebuild.buildWorkspaceId);
            if (workspace) {
                userId = workspace.ownerId;
            } else {
                // this is a bit unorthodox but should still work: the userId is used to build the workspace exchange topic
                // on which we send the message. We hardly every (if ever at all) listen for user-specific updates, the prebuild
                // status maintainer certainly doesn't. Thus, even if userId is unknown, most parts of the system should still work.
                //
                // Mind, this branch is really the exception. Other parts of the system will have broken before we get here, i.e.
                // see a prebuild workspace without an actual workspace attached.
                userId = 'unknown';
            }

            await this.messagebus.notifyHeadlessUpdate({span}, userId, prebuild.buildWorkspaceId, <HeadlessWorkspaceEvent>{
                type: HeadlessWorkspaceEventType.Aborted,
                workspaceID: prebuild.buildWorkspaceId,
            });
        } catch (err) {
            TraceContext.logError({span}, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    dispose(): void {
        if (this.messagebusListener) {
            this.messagebusListener.dispose();
            this.messagebusListener = undefined;
        }
        if (this.periodicMaintainer !== undefined) {
            clearInterval(this.periodicMaintainer);
            this.periodicMaintainer = undefined;
        }
    }

}