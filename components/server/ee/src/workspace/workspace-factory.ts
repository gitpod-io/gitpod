/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { v4 as uuidv4 } from 'uuid';
import { WorkspaceFactory } from "../../../src/workspace/workspace-factory";
import { injectable, inject } from "inversify";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { User, StartPrebuildContext, Workspace, CommitContext, PrebuiltWorkspaceContext, WorkspaceContext, WithSnapshot, WithPrebuild, TaskConfig, PrebuiltWorkspace, WorkspaceConfig, WorkspaceImageSource } from "@gitpod/gitpod-protocol";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { LicenseEvaluator } from '@gitpod/licensor/lib';
import { Feature } from '@gitpod/licensor/lib/api';
import { ResponseError } from 'vscode-jsonrpc';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import { HostContextProvider } from '../../../src/auth/host-context-provider';

@injectable()
export class WorkspaceFactoryEE extends WorkspaceFactory {

    @inject(LicenseEvaluator) protected readonly licenseEvaluator: LicenseEvaluator;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;

    protected requireEELicense(feature: Feature) {
        if (!this.licenseEvaluator.isEnabled(feature)) {
            throw new ResponseError(ErrorCodes.EE_LICENSE_REQUIRED, "enterprise license required");
        }
    }

    public async createForContext(ctx: TraceContext, user: User, context: WorkspaceContext, normalizedContextURL: string): Promise<Workspace> {
        if (StartPrebuildContext.is(context)) {
            return this.createForStartPrebuild(ctx, user, context, normalizedContextURL);
        } else if (PrebuiltWorkspaceContext.is(context)) {
            return this.createForPrebuiltWorkspace(ctx, user, context, normalizedContextURL);
        }

        return super.createForContext(ctx, user, context, normalizedContextURL);
    }

    protected async createForStartPrebuild(ctx: TraceContext, user: User, context: StartPrebuildContext, normalizedContextURL: string): Promise<Workspace> {
        this.requireEELicense(Feature.FeaturePrebuild);
        const span = TraceContext.startSpan("createForStartPrebuild", ctx);

        try {
            if (!CommitContext.is(context.actual)) {
                throw new Error("Can only prebuild workspaces with a commit context")
            }

            const { project, branch } = context;

            const commitContext: CommitContext = context.actual;
            const existingPWS = await this.db.trace({span}).findPrebuiltWorkspaceByCommit(commitContext.repository.cloneUrl, CommitContext.getCommitSHAs(commitContext));
            if (existingPWS) {
                const wsInstance = await this.db.trace({span}).findRunningInstance(existingPWS.buildWorkspaceId);
                if (wsInstance) {
                    throw new Error("A prebuild is already running for this commit.");
                }
            }

            const { config } = await this.configProvider.fetchConfig({span}, user, context.actual);
            const imageSource = await this.imageSourceProvider.getImageSource(ctx, user, context.actual, config);

            // Walk back the commit history to find suitable parent prebuild to start an incremental prebuild on.
            // TODO this doesn't work for multi-repo projects. We should fetch the last few available prebuilds and iterate over them instead.
            let ws;
            if (context.commitHistory && context.commitHistory.length > 0) {
                const recentPrebuilds = await this.db.trace({span}).findPrebuildsWithWorkpace(commitContext.repository.cloneUrl, 20);
                const match = recentPrebuilds.find(pb => this.isGoodBaseforIncrementalPrebuild(context, config, imageSource, pb.prebuild, pb.workspace));
                if (match) {
                    const incrementalPrebuildContext: PrebuiltWorkspaceContext = {
                        title: `Incremental prebuild of "${commitContext.title}"`,
                        originalContext: commitContext,
                        prebuiltWorkspace: match.prebuild,
                    }
                    ws = await this.createForPrebuiltWorkspace({span}, user, incrementalPrebuildContext, normalizedContextURL);
                }
            }
            if (!ws) {
                // No suitable parent prebuild was found -- create a (fresh) full prebuild.
                ws = await this.createForCommit({span}, user, commitContext, normalizedContextURL);
            }
            ws.type = "prebuild";
            ws.projectId = project?.id;
            ws = await this.db.trace({span}).store(ws);

            const pws = await this.db.trace({span}).storePrebuiltWorkspace({
                id: uuidv4(),
                buildWorkspaceId: ws.id,
                cloneURL: commitContext.repository.cloneUrl,
                commit: CommitContext.getCommitSHAs(commitContext),
                state: "queued",
                creationTime: new Date().toISOString(),
                projectId: ws.projectId,
                branch
            });

            log.debug({ userId: user.id, workspaceId: ws.id }, `Registered workspace prebuild: ${pws.id} for ${commitContext.repository.cloneUrl}:${commitContext.revision}`);

            return ws;
        } catch (e) {
            TraceContext.setError({span}, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    private async isGoodBaseforIncrementalPrebuild(context: StartPrebuildContext, config: WorkspaceConfig, imageSource: WorkspaceImageSource, parentPrebuild: PrebuiltWorkspace, buildWorkspace: Workspace) {
        if (!context.commitHistory || context.commitHistory.length === 0) {
            return false;
        }
        // we are only considering available prebuilds
        if (parentPrebuild.state !== 'available') {
            return false;
        }

        // we are only considering full prebuilds
        if (!!buildWorkspace.basedOnPrebuildId) {
            return false;
        }

        // is the prebuild a parent of the commit history
        const commitSHAs = CommitContext.parseCommitSHAs(parentPrebuild.commit);
        if (commitSHAs.length !== (context.subRepoCommitHistories?.length || 0) + 1) {
            // different number of repos
            return false;
        }

        // check the sommits are included in the commit history
        for (let i = 0; i < commitSHAs.length; i++) {
            if (i === 0) {
                if (!context.commitHistory.some(sha => sha.startsWith(commitSHAs[i]))) {
                    return false;
                }
            } else {
                if (!context.subRepoCommitHistories![i-1].some(sha => sha.startsWith(commitSHAs[i]))) {
                    return false;
                }
            }
        }

        // ensure the image source hasn't changed
        if (JSON.stringify(imageSource) !== JSON.stringify(buildWorkspace.imageSource)) {
            log.debug(`Skipping parent prebuild: Outdated image`, {
                imageSource,
                parentImageSource: buildWorkspace.imageSource,
            });
            return false;
        }

        // ensure the tasks haven't changed
        const filterPrebuildTasks = (tasks: TaskConfig[] = []) => (tasks
            .map(task => Object.keys(task)
            .filter(key => ['before', 'init', 'prebuild'].includes(key))
            // @ts-ignore
            .reduce((obj, key) => ({ ...obj, [key]: task[key] }), {}))
            .filter(task => Object.keys(task).length > 0));
        const prebuildTasks = filterPrebuildTasks(config.tasks);
        const parentPrebuildTasks = filterPrebuildTasks(buildWorkspace.config.tasks);
        if (JSON.stringify(prebuildTasks) !== JSON.stringify(parentPrebuildTasks)) {
            log.debug(`Skipping parent prebuild: Outdated prebuild tasks`, {
                prebuildTasks,
                parentPrebuildTasks,
            });
            return false;
        }
    }

    protected async createForPrebuiltWorkspace(ctx: TraceContext, user: User, context: PrebuiltWorkspaceContext, normalizedContextURL: string): Promise<Workspace> {
        this.requireEELicense(Feature.FeaturePrebuild);
        const span = TraceContext.startSpan("createForPrebuiltWorkspace", ctx);

        try {
            const buildWorkspaceID = context.prebuiltWorkspace.buildWorkspaceId;
            const buildWorkspace = await this.db.trace({span}).findById(buildWorkspaceID);
            if (!buildWorkspace) {
                log.error({ userId: user.id }, `No build workspace with ID ${buildWorkspaceID} found - falling back to original context`);
                span.log({'error': `No build workspace with ID ${buildWorkspaceID} found - falling back to original context`});
                return await this.createForContext({span}, user, context.originalContext, normalizedContextURL);
            }
            const config = { ... buildWorkspace.config };
            config.vscode = {
                extensions: config && config.vscode && config.vscode.extensions || []
            }

            const project = await this.projectDB.findProjectByCloneUrl(context.prebuiltWorkspace.cloneURL);
            let projectId: string | undefined;
            // associate with a project, if it's the personal project of the current user
            if (project?.userId && project?.userId === user.id) {
                projectId = project.id;
            }
            // associate with a project, if the current user is a team member
            if (project?.teamId) {
                const teams = await this.teamDB.findTeamsByUser(user.id);
                if (teams.some(t => t.id === project?.teamId)) {
                    projectId = project.id;
                }
            }

            const id = await this.generateWorkspaceID(context);
            const newWs: Workspace = {
                id,
                type: "regular",
                creationTime: new Date().toISOString(),
                contextURL: normalizedContextURL,
                projectId,
                description: this.getDescription(context),
                ownerId: user.id,
                context: <WorkspaceContext & WithSnapshot & WithPrebuild>{
                    ...context.originalContext,
                    snapshotBucketId: context.prebuiltWorkspace.snapshot,
                    prebuildWorkspaceId: context.prebuiltWorkspace.id,
                    wasPrebuilt: true,
                },
                imageSource: buildWorkspace.imageSource,
                imageNameResolved: buildWorkspace.imageNameResolved,
                baseImageNameResolved: buildWorkspace.baseImageNameResolved,
                basedOnPrebuildId: context.prebuiltWorkspace.id,
                config
            };
            await this.db.trace({span}).store(newWs);
            return newWs;
        } catch (e) {
            TraceContext.setError({span}, e);
            throw e;
        } finally {
            span.finish();
        }
    }

}