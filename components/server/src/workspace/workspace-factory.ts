/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v4 as uuidv4 } from "uuid";
import { DBWithTracing, TracedWorkspaceDB, WorkspaceDB, TeamDB } from "@gitpod/gitpod-db/lib";
import {
    AdditionalContentContext,
    CommitContext,
    IssueContext,
    OpenPrebuildContext,
    PrebuiltWorkspaceContext,
    Project,
    PullRequestContext,
    SnapshotContext,
    StartPrebuildContext,
    User,
    WithPrebuild,
    WithSnapshot,
    Workspace,
    WorkspaceContext,
    WorkspaceImageSourceDocker,
} from "@gitpod/gitpod-protocol";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { generateWorkspaceID } from "@gitpod/gitpod-protocol/lib/util/generate-workspace-id";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { inject, injectable } from "inversify";
import { ImageFileRevisionMissing, RepoURL } from "../repohost";
import { ConfigProvider } from "./config-provider";
import { ImageSourceProvider } from "./image-source-provider";
import { increasePrebuildsStartedCounter } from "../prometheus-metrics";
import { Authorizer } from "../authorization/authorizer";

@injectable()
export class WorkspaceFactory {
    constructor(
        @inject(TracedWorkspaceDB) private readonly db: DBWithTracing<WorkspaceDB>,
        @inject(TeamDB) private readonly teamDB: TeamDB,
        @inject(ConfigProvider) private configProvider: ConfigProvider,
        @inject(ImageSourceProvider) private imageSourceProvider: ImageSourceProvider,
        @inject(Authorizer) private readonly authorizer: Authorizer,
    ) {}

    public async createForContext(
        ctx: TraceContext,
        user: User,
        organizationId: string,
        project: Project | undefined,
        context: WorkspaceContext,
        normalizedContextURL: string,
    ): Promise<Workspace> {
        if (StartPrebuildContext.is(context)) {
            if (!project) {
                throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Cannot start prebuild without a project.");
            }
            return this.createForStartPrebuild(ctx, user, project?.id, organizationId, context, normalizedContextURL);
        } else if (PrebuiltWorkspaceContext.is(context)) {
            return this.createForPrebuiltWorkspace(ctx, user, organizationId, project, context, normalizedContextURL);
        }
        if (SnapshotContext.is(context)) {
            return this.createForSnapshot(ctx, user, organizationId, context);
        } else if (CommitContext.is(context)) {
            return this.createForCommit(ctx, user, organizationId, project, context, normalizedContextURL);
        }

        log.error({ userId: user.id }, "Couldn't create workspace for context", context);
        throw new Error("Couldn't create workspace for context");
    }

    private async createForStartPrebuild(
        ctx: TraceContext,
        user: User,
        projectId: string,
        organizationId: string,
        context: StartPrebuildContext,
        normalizedContextURL: string,
    ): Promise<Workspace> {
        const span = TraceContext.startSpan("createForStartPrebuild", ctx);

        try {
            if (!CommitContext.is(context.actual)) {
                throw new ApplicationError(
                    ErrorCodes.BAD_REQUEST,
                    "Can only prebuild workspaces with a commit context",
                );
            }

            const { project, branch } = context;

            const commitContext: CommitContext = context.actual;

            const assertNoPrebuildIsRunningForSameCommit = async () => {
                const existingPWS = await this.db
                    .trace({ span })
                    .findPrebuiltWorkspaceByCommit(projectId, CommitContext.computeHash(commitContext));
                if (!existingPWS) {
                    return;
                }
                log.debug("Found existing prebuild in createForStartPrebuild.", {
                    context,
                    cloneUrl: commitContext.repository.cloneUrl,
                    commit: CommitContext.computeHash(commitContext),
                });
                const wsInstance = await this.db.trace({ span }).findRunningInstance(existingPWS.buildWorkspaceId);
                if (wsInstance) {
                    throw new ApplicationError(ErrorCodes.CONFLICT, "A prebuild is already running for this commit.");
                }
            };

            await assertNoPrebuildIsRunningForSameCommit();

            let ws = await this.createForCommit(
                { span },
                user,
                organizationId,
                project,
                commitContext,
                normalizedContextURL,
            );
            ws.type = "prebuild";
            ws.projectId = project?.id;
            ws = await this.db.trace({ span }).store(ws);

            const pws = await this.db.trace({ span }).storePrebuiltWorkspace({
                id: uuidv4(),
                buildWorkspaceId: ws.id,
                cloneURL: commitContext.repository.cloneUrl,
                commit: CommitContext.computeHash(commitContext),
                state: "queued",
                creationTime: new Date().toISOString(),
                projectId: ws.projectId,
                branch,
                statusVersion: 0,
            });

            if (pws) {
                increasePrebuildsStartedCounter();
            }

            log.debug(
                { userId: user.id, workspaceId: ws.id },
                `Registered workspace prebuild: ${pws.id} for ${commitContext.repository.cloneUrl}:${commitContext.revision}`,
            );

            return ws;
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    private async createForPrebuiltWorkspace(
        ctx: TraceContext,
        user: User,
        organizationId: string,
        project: Project | undefined,
        context: PrebuiltWorkspaceContext,
        normalizedContextURL: string,
    ): Promise<Workspace> {
        const span = TraceContext.startSpan("createForPrebuiltWorkspace", ctx);
        try {
            const buildWorkspaceID = context.prebuiltWorkspace.buildWorkspaceId;
            const buildWorkspace = await this.db.trace({ span }).findById(buildWorkspaceID);
            if (!buildWorkspace) {
                log.error(
                    { userId: user.id },
                    `No build workspace with ID ${buildWorkspaceID} found - falling back to original context`,
                );
                span.log({
                    error: `No build workspace with ID ${buildWorkspaceID} found - falling back to original context`,
                });
                return await this.createForContext(
                    { span },
                    user,
                    organizationId,
                    project,
                    context.originalContext,
                    normalizedContextURL,
                );
            }
            const config = { ...buildWorkspace.config };
            config.vscode = {
                extensions: (config && config.vscode && config.vscode.extensions) || [],
            };

            let projectId: string | undefined;
            // associate with a project, if the current user is a team member
            if (project) {
                const teams = await this.teamDB.findTeamsByUser(user.id);
                if (teams.some((t) => t.id === project.teamId)) {
                    projectId = project.id;
                    await this.authorizer.checkPermissionOnProject(user.id, "read_prebuild", projectId);
                }
            }

            if (OpenPrebuildContext.is(context.originalContext)) {
                if (CommitContext.is(buildWorkspace.context)) {
                    if (
                        CommitContext.is(context.originalContext) &&
                        CommitContext.computeHash(context.originalContext) !==
                            CommitContext.computeHash(buildWorkspace.context)
                    ) {
                        // If the current context has a newer/different commit hash than the prebuild
                        // we force the checkout of the revision rather than the ref/branch.
                        // Otherwise we'd get the correct prebuild with the "wrong" Git ref.
                        delete buildWorkspace.context.ref;
                    }
                }

                // Because of incremental prebuilds, createForContext will take over the original context.
                // To ensure we get the right commit when forcing a prebuild, we force the context here.
                context.originalContext = buildWorkspace.context;
            }

            const id = await this.generateWorkspaceID(context);
            const newWs: Workspace = {
                id,
                type: "regular",
                creationTime: new Date().toISOString(),
                organizationId,
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
                config,
            };
            await this.db.trace({ span }).store(newWs);
            return newWs;
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    private async createForSnapshot(
        ctx: TraceContext,
        user: User,
        organizationId: string,
        context: SnapshotContext,
    ): Promise<Workspace> {
        const span = TraceContext.startSpan("createForSnapshot", ctx);

        try {
            const snapshot = await this.db.trace({ span }).findSnapshotById(context.snapshotId);
            if (!snapshot) {
                throw new ApplicationError(
                    ErrorCodes.NOT_FOUND,
                    "No snapshot with id '" + context.snapshotId + "' found.",
                );
            }
            const workspace = await this.db.trace({ span }).findById(snapshot.originalWorkspaceId);
            if (!workspace) {
                throw new Error(
                    `Internal error: snapshot ${snapshot.id} points to no existing workspace ${snapshot.originalWorkspaceId}.`,
                );
            }
            if (workspace.deleted || !workspace.context || !CommitContext.is(workspace.context)) {
                throw new Error(`The original workspace has been deleted - cannot open this snapshot.`);
            }

            const id = await this.generateWorkspaceID(context);
            const date = new Date().toISOString();

            const newWs: Workspace = {
                id,
                type: "regular",
                creationTime: date,
                ownerId: user.id,
                organizationId: organizationId,
                config: workspace.config,
                context: <SnapshotContext>{
                    ...workspace.context,
                    ...context,
                    snapshotBucketId: snapshot.bucketId,
                    title: workspace.description,
                },
                contextURL: workspace.contextURL,
                description: workspace.description,
                imageNameResolved: workspace.imageNameResolved,
                baseImageNameResolved: workspace.baseImageNameResolved,
                basedOnSnapshotId: context.snapshotId,
                imageSource: workspace.imageSource,
            };
            await this.db.trace({ span }).store(newWs);
            return newWs;
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    private async createForCommit(
        ctx: TraceContext,
        user: User,
        organizationId: string,
        project: Project | undefined,
        context: CommitContext,
        normalizedContextURL: string,
    ) {
        const span = TraceContext.startSpan("createForCommit", ctx);

        try {
            const { config, literalConfig } = await this.configProvider.fetchConfig(
                { span },
                user,
                context,
                organizationId,
            );
            const imageSource = await this.imageSourceProvider.getImageSource(ctx, user, context, config);
            if (config._origin === "derived" && literalConfig) {
                (context as any as AdditionalContentContext).additionalFiles = { ...literalConfig };
            }
            if (WorkspaceImageSourceDocker.is(imageSource) && imageSource.dockerFileHash === ImageFileRevisionMissing) {
                // we let the workspace create here and let it fail to build the image
                imageSource.dockerFileHash = context.revision;
                if (imageSource.dockerFileSource) {
                    imageSource.dockerFileSource.revision = context.revision;
                }
            }

            let projectId: string | undefined;
            // associate with a project, if the current user is a team member
            if (project) {
                const teams = await this.teamDB.findTeamsByUser(user.id);
                if (teams.some((t) => t.id === project.teamId)) {
                    projectId = project.id;
                }
            }

            const id = await this.generateWorkspaceID(context);
            const newWs: Workspace = {
                id,
                type: "regular",
                organizationId: organizationId,
                creationTime: new Date().toISOString(),
                contextURL: normalizedContextURL,
                projectId,
                description: this.getDescription(context),
                ownerId: user.id,
                context,
                imageSource,
                config,
            };
            await this.db.trace({ span }).store(newWs);
            return newWs;
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    private getDescription(context: WorkspaceContext): string {
        if (PullRequestContext.is(context) || IssueContext.is(context)) {
            return `#${context.nr}: ${context.title}`;
        }
        return context.title;
    }

    private async generateWorkspaceID(context: WorkspaceContext): Promise<string> {
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
