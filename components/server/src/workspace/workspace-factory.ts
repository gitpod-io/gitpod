/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';

import { User, PullRequestContext, IssueContext, WorkspaceContext, Repository, CommitContext, WorkspaceProbeContext, WorkspaceConfig } from '@gitpod/gitpod-protocol';
import { Workspace, SnapshotContext } from '@gitpod/gitpod-protocol';
import { WorkspaceDB } from '@gitpod/gitpod-db/lib/workspace-db';
import { UserDB } from '@gitpod/gitpod-db/lib/user-db';

import { ConfigProvider } from './config-provider';
import { ResponseError } from 'vscode-jsonrpc';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { ImageBuilderClientProvider } from '@gitpod/image-builder/lib';
import { TracedWorkspaceDB, DBWithTracing } from '@gitpod/gitpod-db/lib/traced-db';
import { ImageSourceProvider } from './image-source-provider';
import { TheiaPluginService } from '../theia-plugin/theia-plugin-service';
import { generateWorkspaceID } from '@gitpod/gitpod-protocol/lib/util/generate-workspace-id';

@injectable()
export class WorkspaceFactory {
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(TracedWorkspaceDB) protected readonly db: DBWithTracing<WorkspaceDB>;
    @inject(ConfigProvider) protected configProvider: ConfigProvider;
    @inject(ImageBuilderClientProvider) protected imagebuilderClientProvider: ImageBuilderClientProvider;
    @inject(ImageSourceProvider) protected imageSourceProvider: ImageSourceProvider;
    @inject(TheiaPluginService) protected readonly pluginService: TheiaPluginService;

    public async createForContext(ctx: TraceContext, user: User, context: WorkspaceContext, normalizedContextURL: string): Promise<Workspace> {
        if (SnapshotContext.is(context)) {
            return this.createForSnapshot(ctx, user, context);
        } else if (CommitContext.is(context)) {
            return this.createForCommit(ctx, user, context, normalizedContextURL);
        } else if (WorkspaceProbeContext.is(context)) {
            return this.createForWorkspaceProbe(ctx, user, context, normalizedContextURL);
        }
        log.error({userId: user.id}, "Couldn't create workspace for context", context);
        throw new Error("Couldn't create workspace for context");
    }

    protected async createForWorkspaceProbe(ctx: TraceContext, user: User, context: WorkspaceProbeContext, contextURL: string): Promise<Workspace> {
        const span = TraceContext.startSpan("createForWorkspaceProbe", ctx);

        try {
            // TODO: we need to find a better base image.
            const image = "csweichel/alpine-curl:latest";
            const config = <WorkspaceConfig>{
                image,
                tasks: [
                    {
                        init: `curl -sSLu Bearer:${context.responseToken} ${context.responseURL}`
                    }
                ]
            };

            // This only works because image is a string, otherwise we'd have to go through the full workspace build process.
            // Basically we're using the raw alpine image bait-and-switch style without adding the GP layer.
            const imageSource = await this.imageSourceProvider.getImageSource(ctx, user, null as any, config);

            const id = await generateWorkspaceID();
            const date = new Date().toISOString();
            const newWs: Workspace = {
                id,
                type: "probe",
                creationTime: date,
                ownerId: user.id,
                config,
                context,
                contextURL,
                imageSource,
                description: "workspace probe",
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

    protected async createForSnapshot(ctx: TraceContext, user: User, context: SnapshotContext): Promise<Workspace> {
        const span = TraceContext.startSpan("createForSnapshot", ctx);

        try {
            const snapshot = await this.db.trace({span}).findSnapshotById(context.snapshotId);
            if (!snapshot) {
                throw new ResponseError(ErrorCodes.NOT_FOUND, "No snapshot with id '" + context.snapshotId + "' found.");
            }
            const workspace = await this.db.trace({span}).findById(snapshot.originalWorkspaceId);
            if (!workspace) {
                throw new Error(`Internal error: snapshot ${snapshot.id} points to no existing workspace ${snapshot.originalWorkspaceId}.`);
            }
            if (workspace.deleted || !workspace.context || !CommitContext.is(workspace.context)) {
                throw new Error(`The original workspace has been deleted - cannot open this snapshot.`);
            }

            const id = await generateWorkspaceID();
            const date = new Date().toISOString();
            const newWs = <Workspace>{
                id,
                type: "regular",
                creationTime: date,
                ownerId: user.id,
                config: workspace.config,
                context: <SnapshotContext>{
                    ... workspace.context,
                    ... context,
                    snapshotBucketId: snapshot.bucketId,
                    title: workspace.description
                },
                contextURL: workspace.contextURL,
                description: workspace.description,
                imageNameResolved: workspace.imageNameResolved,
                baseImageNameResolved: workspace.baseImageNameResolved,
                basedOnSnapshotId: context.snapshotId,
                imageSource: workspace.imageSource
            };
            if (snapshot.layoutData) {
                // we don't need to await here, as the layoutdata will be requested earliest in a couple of seconds by the theia IDE
                this.db.trace({span}).storeLayoutData({
                    workspaceId: id,
                    lastUpdatedTime: date,
                    layoutData: snapshot.layoutData
                });
            }
            await this.db.trace({span}).store(newWs);
            return newWs;
        } catch (e) {
            TraceContext.logError({span}, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async createForCommit(ctx: TraceContext, user: User, context: CommitContext, normalizedContextURL: string) {
        const span = TraceContext.startSpan("createForCommit", ctx);

        try {
            const config = await this.configProvider.fetchConfig({span}, user, context);
            const imageSource = await this.imageSourceProvider.getImageSource(ctx, user, context, config);

            const id = await generateWorkspaceID();
            const newWs: Workspace = {
                id,
                type: "regular",
                creationTime: new Date().toISOString(),
                contextURL: normalizedContextURL,
                description: this.getDescription(context),
                ownerId: user.id,
                context,
                imageSource,
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

    protected async isRepositoryOrSourceWhitelisted(repository : Repository): Promise<boolean> {
        const repoIsWhiteListed = await this.db.trace({}).isWhitelisted(repository.cloneUrl);
        if(repoIsWhiteListed) {
            return true;
        } else if(repository.fork) {
            return this.isRepositoryOrSourceWhitelisted(repository.fork.parent)
        } else {
            return false;
        }
    }

    protected getDescription(context: WorkspaceContext): string {
        if (PullRequestContext.is(context) || IssueContext.is(context)) {
            return `#${context.nr}: ${context.title}`;
        }
        return context.title;
    }

}