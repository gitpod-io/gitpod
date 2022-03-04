/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { DBWithTracing, TracedWorkspaceDB, WorkspaceDB, ProjectDB, TeamDB } from '@gitpod/gitpod-db/lib';
import { AdditionalContentContext, CommitContext, IssueContext, PrebuiltWorkspaceContext, PullRequestContext, Repository, SnapshotContext, User, Workspace, WorkspaceConfig, WorkspaceContext, WorkspaceProbeContext } from '@gitpod/gitpod-protocol';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import { generateWorkspaceID } from '@gitpod/gitpod-protocol/lib/util/generate-workspace-id';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { inject, injectable } from 'inversify';
import { ResponseError } from 'vscode-jsonrpc';
import { RepoURL } from '../repohost';
import { ConfigProvider } from './config-provider';
import { ImageSourceProvider } from './image-source-provider';

@injectable()
export class WorkspaceFactory {

    @inject(TracedWorkspaceDB) protected readonly db: DBWithTracing<WorkspaceDB>;
    @inject(ProjectDB) protected readonly projectDB: ProjectDB;
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(ConfigProvider) protected configProvider: ConfigProvider;
    @inject(ImageSourceProvider) protected imageSourceProvider: ImageSourceProvider;

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
            const config: WorkspaceConfig = {
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

            const id = await this.generateWorkspaceID(context);
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
            TraceContext.setError({span}, e);
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

            const id = await this.generateWorkspaceID(context);
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
                /** no await */ this.db.trace({span}).storeLayoutData({
                    workspaceId: id,
                    lastUpdatedTime: date,
                    layoutData: snapshot.layoutData
                }).catch(err => log.error("createForSnapshot.storeLayoutData", err));
            }
            await this.db.trace({span}).store(newWs);
            return newWs;
        } catch (e) {
            TraceContext.setError({span}, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async createForCommit(ctx: TraceContext, user: User, context: CommitContext, normalizedContextURL: string) {
        const span = TraceContext.startSpan("createForCommit", ctx);

        try {
            // TODO(janx): We potentially fetch the same Project twice in this flow (once here, and once in `configProvider`,
            // to parse a potential custom config from the Project DB). It would be cool to fetch the Project only once (and
            // e.g. pass it to `configProvider.fetchConfig` here).
            const [ { config, literalConfig} , project ] = await Promise.all([
                this.configProvider.fetchConfig({ span }, user, context),
                this.projectDB.findProjectByCloneUrl(context.repository.cloneUrl),
            ]);
            const imageSource = await this.imageSourceProvider.getImageSource(ctx, user, context, config);
            if (config._origin === 'project-db') {
                // If the project is configured via the Project DB, place the uncommitted configuration into the workspace,
                // thus encouraging Git-based configurations.
                if (project?.config) {
                    (context as any as AdditionalContentContext).additionalFiles = { ...project.config };
                }
            }
            if (config._origin === 'derived' && literalConfig) {
                (context as any as AdditionalContentContext).additionalFiles = { ... literalConfig };
            }

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
                context,
                imageSource,
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

    protected async generateWorkspaceID(context: WorkspaceContext): Promise<string> {
        let ctx = context;
        if (PrebuiltWorkspaceContext.is(context)) {
            ctx = context.originalContext;
        }
        if (CommitContext.is(ctx)) {
            const parsed = RepoURL.parseRepoUrl(ctx.repository.cloneUrl);
            return await generateWorkspaceID(parsed?.owner, parsed?.repo);
        }
        return await generateWorkspaceID();
    }

}