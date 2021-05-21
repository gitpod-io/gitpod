/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as uuidv4 from 'uuid/v4';
import { WorkspaceFactory } from "../../../src/workspace/workspace-factory";
import { injectable, inject } from "inversify";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { User, StartPrebuildContext, Workspace, CommitContext, PrebuiltWorkspaceContext, WorkspaceContext, WithSnapshot, WithPrebuild, TaskConfig } from "@gitpod/gitpod-protocol";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { LicenseEvaluator } from '@gitpod/licensor/lib';
import { Feature } from '@gitpod/licensor/lib/api';
import { ResponseError } from 'vscode-jsonrpc';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import { WorkspaceDB } from '@gitpod/gitpod-db/lib/workspace-db';
import { generateWorkspaceID } from '@gitpod/gitpod-protocol/lib/util/generate-workspace-id';

@injectable()
export class WorkspaceFactoryEE extends WorkspaceFactory {
    @inject(LicenseEvaluator) protected readonly licenseEvaluator: LicenseEvaluator;
    @inject(WorkspaceDB) protected readonly workspaceDB: WorkspaceDB;

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

            const commitContext: CommitContext = context.actual;
            const existingPWS = await this.db.trace({span}).findPrebuiltWorkspaceByCommit(commitContext.repository.cloneUrl, commitContext.revision);
            if (existingPWS) {
                const wsInstance = await this.db.trace({span}).findRunningInstance(existingPWS.buildWorkspaceId);
                if (wsInstance) {
                    throw new Error("A prebuild is already running for this commit.");
                }
            }

            const config = await this.configProvider.fetchConfig({span}, user, context.actual);
            const imageSource = await this.imageSourceProvider.getImageSource(ctx, user, context.actual, config);

            // Walk back the commit history to find suitable parent prebuild to start an incremental prebuild on.
            let ws;
            for (const parent of (context.commitHistory || [])) {
                const parentPrebuild = await this.db.trace({span}).findPrebuiltWorkspaceByCommit(commitContext.repository.cloneUrl, parent);
                if (!parentPrebuild) {
                    continue;
                }
                if (parentPrebuild.state !== 'available') {
                    continue;
                }
                log.debug(`Considering parent prebuild for ${commitContext.revision}`, parentPrebuild);
                const buildWorkspace = await this.db.trace({span}).findById(parentPrebuild.buildWorkspaceId);
                if (!buildWorkspace) {
                    continue;
                }
                if (!!buildWorkspace.basedOnPrebuildId) {
                    continue;
                }
                if (JSON.stringify(imageSource) !== JSON.stringify(buildWorkspace.imageSource)) {
                    log.debug(`Skipping parent prebuild: Outdated image`, {
                        imageSource,
                        parentImageSource: buildWorkspace.imageSource,
                    });
                    continue;
                }
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
                    continue;
                }
                const incrementalPrebuildContext: PrebuiltWorkspaceContext = {
                    title: `Incremental prebuild of "${commitContext.title}"`,
                    originalContext: commitContext,
                    prebuiltWorkspace: parentPrebuild,
                }
                ws = await this.createForPrebuiltWorkspace({span}, user, incrementalPrebuildContext, normalizedContextURL);
                break;
            }

            if (!ws) {
                // No suitable parent prebuild was found -- create a (fresh) full prebuild.
                ws = await this.createForCommit({span}, user, commitContext, normalizedContextURL);
            }
            ws.type = "prebuild";
            ws = await this.db.trace({span}).store(ws);

            const pws = await this.db.trace({span}).storePrebuiltWorkspace({
                id: uuidv4(),
                buildWorkspaceId: ws.id,
                cloneURL: commitContext.repository.cloneUrl,
                commit: commitContext.revision,
                state: "queued",
                creationTime: new Date().toISOString()
            });

            log.debug({ userId: user.id, workspaceId: ws.id }, `Registered workspace prebuild: ${pws.id} for ${commitContext.repository.cloneUrl}:${commitContext.revision}`);

            return ws;
        } catch (e) {
            TraceContext.logError({span}, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async createForPrebuiltWorkspace(ctx: TraceContext, user: User, context: PrebuiltWorkspaceContext, normalizedContextURL: string): Promise<Workspace> {
        this.requireEELicense(Feature.FeaturePrebuild);
        const span = TraceContext.startSpan("createForPrebuiltWorkspace", ctx);

        const fallback = await this.fallbackIfOutPrebuildTime(ctx, user, context, normalizedContextURL);
        if (!!fallback) {
            return fallback;
        }

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

            const id = await generateWorkspaceID();
            const newWs: Workspace = {
                id,
                type: "regular",
                creationTime: new Date().toISOString(),
                contextURL: normalizedContextURL,
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
            TraceContext.logError({span}, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async fallbackIfOutPrebuildTime(ctx: TraceContext, user: User, context: PrebuiltWorkspaceContext, normalizedContextURL: string): Promise<Workspace | undefined> {
        const prebuildTime = await this.workspaceDB.getTotalPrebuildUseSeconds(30);
        if (!this.licenseEvaluator.canUsePrebuild(prebuildTime || 0)) {
            // TODO: find a way to signal the out-of-prebuild-time situation
            log.warn({}, "cannot use prebuild because enterprise license prevents it", {prebuildTime});
            return this.createForContext(ctx, user, context.originalContext, normalizedContextURL);
        }

        return;
    }

}