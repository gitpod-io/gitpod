/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DBWithTracing, TracedWorkspaceDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import {
    CommitContext,
    CommitInfo,
    PrebuildWithStatus,
    PrebuiltWorkspace,
    Project,
    StartPrebuildContext,
    StartPrebuildResult,
    TaskConfig,
    User,
    Workspace,
    WorkspaceConfig,
} from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { getCommitInfo, HostContextProvider } from "../auth/host-context-provider";
import { ConfigProvider } from "../workspace/config-provider";
import { Config } from "../config";
import { ProjectsService } from "../projects/projects-service";
import { secondsBefore } from "@gitpod/gitpod-protocol/lib/util/timeutil";

import { inject, injectable } from "inversify";
import * as opentracing from "opentracing";
import { IncrementalWorkspaceService } from "./incremental-workspace-service";
import { PrebuildRateLimiterConfig } from "../workspace/prebuild-rate-limiter";
import { ErrorCodes, ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { EntitlementService, MayStartWorkspaceResult } from "../billing/entitlement-service";
import { WorkspaceService } from "../workspace/workspace-service";
import { minimatch as globMatch } from "minimatch";
import { Authorizer } from "../authorization/authorizer";
import { ContextParser } from "../workspace/context-parser-service";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { generateAsyncGenerator } from "@gitpod/gitpod-protocol/lib/generate-async-generator";
import { RedisSubscriber } from "../messaging/redis-subscriber";

export interface StartPrebuildParams {
    user: User;
    context: CommitContext;
    project: Project;
    commitInfo?: CommitInfo;
    forcePrebuild?: boolean;
}

export interface PrebuildFilter {
    configuration?: {
        id: string;
        branch?: string;
    };
    state?: "failed" | "succeeded" | "unfinished";
    searchTerm?: string;
}

@injectable()
export class PrebuildManager {
    constructor(
        @inject(TracedWorkspaceDB) private readonly workspaceDB: DBWithTracing<WorkspaceDB>,
        @inject(WorkspaceService) private readonly workspaceService: WorkspaceService,
        @inject(HostContextProvider) private readonly hostContextProvider: HostContextProvider,
        @inject(ConfigProvider) private readonly configProvider: ConfigProvider,
        @inject(Config) private readonly config: Config,
        @inject(ProjectsService) private readonly projectService: ProjectsService,
        @inject(IncrementalWorkspaceService) private readonly incrementalPrebuildsService: IncrementalWorkspaceService,
        @inject(EntitlementService) private readonly entitlementService: EntitlementService,
        @inject(Authorizer) private readonly auth: Authorizer,
        @inject(ContextParser) private contextParser: ContextParser,
        @inject(IAnalyticsWriter) private readonly analytics: IAnalyticsWriter,
        @inject(RedisSubscriber) private readonly subscriber: RedisSubscriber,
    ) {}

    private async findNonFailedPrebuiltWorkspace(ctx: TraceContext, projectId: string, commitSHA: string) {
        const existingPB = await this.workspaceDB.trace(ctx).findPrebuiltWorkspaceByCommit(projectId, commitSHA);

        if (
            !!existingPB &&
            existingPB.state !== "aborted" &&
            existingPB.state !== "failed" &&
            existingPB.state !== "timeout"
        ) {
            return existingPB;
        }
        return undefined;
    }

    public async watchPrebuildStatus(
        userId: string,
        configurationId: string,
        opts: { signal: AbortSignal },
    ): Promise<AsyncIterable<PrebuildWithStatus>> {
        await this.auth.checkPermissionOnProject(userId, "read_prebuild", configurationId);
        return generateAsyncGenerator<PrebuildWithStatus>((sink) => {
            try {
                const toDispose = this.subscriber.listenForPrebuildUpdates(configurationId, (_ctx, prebuild) => {
                    sink.push(prebuild);
                });
                return () => {
                    toDispose.dispose();
                };
            } catch (e) {
                if (e instanceof Error) {
                    sink.fail(e);
                } else {
                    sink.fail(new Error(String(e) || "unknown"));
                }
            }
        }, opts);
    }

    public async *getAndWatchPrebuildStatus(
        userId: string,
        filter: {
            configurationId?: string;
            prebuildId?: string;
        },
        opts: { signal: AbortSignal },
    ) {
        if (!filter.configurationId && !filter.prebuildId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `configurationId or prebuildId is required`);
        }
        if (filter.prebuildId) {
            const prebuild = await this.getPrebuild({}, userId, filter.prebuildId);
            if (!prebuild) {
                throw new ApplicationError(ErrorCodes.NOT_FOUND, `prebuild ${filter.prebuildId} not found`);
            }
            if (!prebuild?.info.projectId) {
                throw new ApplicationError(
                    ErrorCodes.PRECONDITION_FAILED,
                    `prebuild ${filter.prebuildId} does not belong to any configuration`,
                );
            }
            // if configurationId not match, we should not continue because we will filter by configuration id below
            if (filter.configurationId && filter.configurationId !== prebuild.info.projectId) {
                throw new ApplicationError(
                    ErrorCodes.BAD_REQUEST,
                    `prebuild ${filter.prebuildId} does not belong to configuration ${filter.configurationId}`,
                );
            }
            filter.configurationId = prebuild.info.projectId;
            yield prebuild;
        }
        const it = await this.watchPrebuildStatus(userId, filter.configurationId!, opts);
        for await (const pb of it) {
            if (filter.prebuildId && pb.info.id !== filter.prebuildId) {
                continue;
            }
            if (pb.info.projectId !== filter.configurationId) {
                continue;
            }
            yield pb;
        }
    }

    async triggerPrebuild(ctx: TraceContext, user: User, projectId: string, branchName: string | null) {
        await this.auth.checkPermissionOnProject(user.id, "write_prebuild", projectId);

        const project = await this.projectService.getProject(user.id, projectId);

        let branchDetails: Project.BranchDetails[] = [];
        try {
            branchDetails = branchName
                ? await this.projectService.getBranchDetails(user, project, branchName)
                : (await this.projectService.getBranchDetails(user, project)).filter((b) => b.isDefault);
        } catch (e) {
            log.error(e);
        } finally {
            if (branchDetails.length !== 1) {
                log.debug({ userId: user.id }, "Cannot find branch details.", { project, branchName });
                throw new ApplicationError(
                    ErrorCodes.NOT_FOUND,
                    `Could not find ${!branchName ? "a default branch" : `branch '${branchName}'`} in repository ${
                        project.cloneUrl
                    }`,
                );
            }
        }
        const contextURL = branchDetails[0].url;

        const context = (await this.contextParser.handle(ctx, user, contextURL)) as CommitContext;

        // HACK: treat manual triggered prebuild as a reset for the inactivity state
        await this.projectService.markActive(user.id, project.id);

        const prebuild = await this.startPrebuild(ctx, {
            context,
            user,
            project,
            forcePrebuild: true,
        });

        this.analytics.track({
            userId: user.id,
            event: "prebuild_triggered",
            properties: {
                context_url: contextURL,
                clone_url: project.cloneUrl,
                commit: context.revision,
                branch: branchDetails[0].name,
                project_id: project.id,
            },
        });

        return prebuild;
    }

    async cancelPrebuild(ctx: TraceContext, userId: string, prebuildId: string): Promise<void> {
        const prebuild = await this.workspaceDB.trace(ctx).findPrebuildByID(prebuildId);
        if (prebuild) {
            await this.auth.checkPermissionOnProject(userId, "write_prebuild", prebuild.projectId!);
        }
        if (!prebuild) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `prebuild ${prebuildId} not found`);
        }
        await this.workspaceService.stopWorkspace(userId, prebuild.buildWorkspaceId, "stopped via API");
    }

    async getPrebuild(
        ctx: TraceContext,
        userId: string,
        prebuildId: string,
        oldPermissionCheck?: (pbws: PrebuiltWorkspace, workspace: Workspace) => Promise<void>, // @deprecated
    ): Promise<PrebuildWithStatus | undefined> {
        const pbws = await this.workspaceDB.trace(ctx).findPrebuiltWorkspaceById(prebuildId);
        if (!pbws) {
            return undefined;
        }
        const [info, workspace] = await Promise.all([
            this.workspaceDB
                .trace(ctx)
                .findPrebuildInfos([prebuildId])
                .then((infos) => (infos.length > 0 ? infos[0] : undefined)),
            this.workspaceDB.trace(ctx).findById(pbws.buildWorkspaceId),
        ]);
        if (!info || !workspace) {
            return undefined;
        }
        if (oldPermissionCheck) {
            await oldPermissionCheck(pbws, workspace);
        }
        await this.auth.checkPermissionOnProject(userId, "read_prebuild", workspace.projectId!);
        const result: PrebuildWithStatus = { info, status: pbws.state, workspace };
        if (pbws.error) {
            result.error = pbws.error;
        }
        return result;
    }

    async listPrebuilds(
        ctx: TraceContext,
        userId: string,
        organizationId: string,
        pagination: {
            limit: number;
            offset: number;
        },
        filter: PrebuildFilter,
        sort: {
            field: string;
            order: "DESC" | "ASC";
        },
    ): Promise<PrebuildWithStatus[]> {
        await this.auth.checkPermissionOnOrganization(userId, "read_prebuild", organizationId);

        const prebuiltWorkspaces = await this.workspaceDB
            .trace(ctx)
            .findPrebuiltWorkspacesByOrganization(organizationId, pagination, filter, sort);
        const prebuildIds = prebuiltWorkspaces.map((prebuild) => prebuild.id);
        const infos = await this.workspaceDB.trace({}).findPrebuildInfos(prebuildIds);
        const prebuildInfosMap = new Map(infos.map((info) => [info.id, info]));

        return prebuiltWorkspaces
            .map((prebuild) => {
                const info = prebuildInfosMap.get(prebuild.id);
                if (!info) {
                    return;
                }

                const fullPrebuild: PrebuildWithStatus = {
                    info,
                    status: prebuild.state,
                    workspace: prebuild.workspace,
                };
                if (prebuild.error) {
                    fullPrebuild.error = prebuild.error;
                }

                return fullPrebuild;
            })
            .filter((prebuild): prebuild is PrebuildWithStatus => !!prebuild); // filter out potential undefined values
    }

    async findPrebuildByWorkspaceID(
        ctx: TraceContext,
        userId: string,
        workspaceId: string,
        oldPermissionCheck?: (pbws: PrebuiltWorkspace, workspace: Workspace) => Promise<void>, // @deprecated
    ): Promise<PrebuiltWorkspace | undefined> {
        const [pbws, workspace] = await Promise.all([
            this.workspaceDB.trace(ctx).findPrebuildByWorkspaceID(workspaceId),
            this.workspaceDB.trace(ctx).findById(workspaceId),
        ]);
        if (!pbws || !workspace) {
            return undefined;
        }
        if (oldPermissionCheck) {
            await oldPermissionCheck(pbws, workspace);
        }
        await this.auth.checkPermissionOnProject(userId, "read_prebuild", workspace.projectId!);
        return pbws;
    }

    async startPrebuild(
        ctx: TraceContext,
        { context, project, user, commitInfo, forcePrebuild }: StartPrebuildParams,
    ): Promise<StartPrebuildResult> {
        const span = TraceContext.startSpan("startPrebuild", ctx);
        const cloneURL = context.repository.cloneUrl;
        const commitSHAIdentifier = CommitContext.computeHash(context);
        span.setTag("cloneURL", cloneURL);
        span.setTag("commit", commitInfo?.sha);

        // TODO figure out right place to mark activity of a project. For now, just moving at the beginning
        // of `startPrebuild` to remain previous semantics when it was happening on call sites.
        this.projectService
            .markActive(user.id, project.id, "lastWebhookReceived")
            .catch((e) => log.error("cannot update project usage", e));

        try {
            if (user.blocked) {
                throw new ApplicationError(
                    ErrorCodes.USER_BLOCKED,
                    `Blocked users cannot start prebuilds (${user.name})`,
                );
            }
            await this.checkUsageLimitReached(user, project.teamId); // throws if out of credits

            const config = await this.fetchConfig({ span }, user, context, project.teamId);

            if (!forcePrebuild) {
                // Check for an existing, successful prebuild, before triggering a new one.
                const existingPB = await this.findNonFailedPrebuiltWorkspace({ span }, project.id, commitSHAIdentifier);
                if (existingPB) {
                    // But if the existing prebuild is failed, or based on an outdated config, it will still be retriggered below.
                    const existingPBWS = await this.workspaceDB.trace({ span }).findById(existingPB.buildWorkspaceId);
                    const existingConfig = existingPBWS?.config;
                    log.debug(
                        `startPrebuild | commits: ${commitSHAIdentifier}, existingPB: ${
                            existingPB.id
                        }, existingConfig: ${JSON.stringify(existingConfig)}, newConfig: ${JSON.stringify(config)}}`,
                    );
                    const filterPrebuildTasks = (tasks: TaskConfig[] = []) =>
                        tasks
                            .map((task) =>
                                Object.keys(task)
                                    .filter((key) => ["before", "init", "prebuild"].includes(key))
                                    // @ts-ignore
                                    .reduce((obj, key) => ({ ...obj, [key]: task[key] }), {}),
                            )
                            .filter((task) => Object.keys(task).length > 0);
                    const isSameConfig =
                        JSON.stringify(filterPrebuildTasks(existingConfig?.tasks)) ===
                        JSON.stringify(filterPrebuildTasks(config?.tasks));
                    // If there is an existing prebuild that isn't failed and it's based on the current config, we return it here instead of triggering a new prebuild.
                    if (isSameConfig) {
                        return { prebuildId: existingPB.id, wsid: existingPB.buildWorkspaceId, done: true };
                    }
                }
            }

            const prebuildContext: StartPrebuildContext = {
                title: `Prebuild of "${context.title}"`,
                actual: context,
                project,
                branch: context.ref,
                normalizedContextURL: context.normalizedContextURL,
            };

            const { commitHistory, additionalRepositoryCommitHistories } =
                await this.incrementalPrebuildsService.getCommitHistoryForContext(context, user);

            const prebuildSettings = Project.getPrebuildSettings(project);
            const prebuildInterval = prebuildSettings.prebuildInterval;
            if (!forcePrebuild && prebuildInterval > 0) {
                const history = {
                    commitHistory: commitHistory?.slice(0, prebuildInterval + 1),
                    additionalRepositoryCommitHistories: additionalRepositoryCommitHistories?.map((repoHist) => ({
                        cloneUrl: repoHist.cloneUrl,
                        commitHistory: repoHist.commitHistory.slice(0, prebuildInterval),
                    })),
                };
                const prebuild = await this.incrementalPrebuildsService.findGoodBaseForIncrementalBuild(
                    context,
                    config,
                    history,
                    user,
                    project.id,
                    true,
                );
                if (prebuild) {
                    return { prebuildId: prebuild.id, wsid: prebuild.buildWorkspaceId, done: true };
                }
            }

            const workspace = await this.workspaceService.createWorkspace(
                { span },
                user,
                project.teamId,
                project,
                prebuildContext,
                context.normalizedContextURL!,
                undefined,
            );

            const prebuild = await this.workspaceDB.trace({ span }).findPrebuildByWorkspaceID(workspace.id)!;
            if (!prebuild) {
                throw new Error(`Failed to create a prebuild for: ${context.normalizedContextURL}`);
            }

            if (project) {
                let aCommitInfo = commitInfo;
                if (!aCommitInfo) {
                    aCommitInfo = await getCommitInfo(
                        this.hostContextProvider,
                        user,
                        context.repository.cloneUrl,
                        context.revision,
                    );
                    if (!aCommitInfo) {
                        aCommitInfo = {
                            author: "unknown",
                            commitMessage: "unknown",
                            sha: context.revision,
                        };
                    }
                }
                await this.storePrebuildInfo({ span }, project, prebuild, workspace, user, aCommitInfo);
            }

            if (await this.shouldRateLimitPrebuild(span, project)) {
                prebuild.state = "aborted";
                prebuild.error =
                    "Prebuild is rate limited. Please contact Gitpod if you believe this happened in error.";
                await this.workspaceDB.trace({ span }).storePrebuiltWorkspace(prebuild);
                span.setTag("ratelimited", true);
            } else if (await this.projectService.isProjectConsideredInactive(user.id, project.id)) {
                prebuild.state = "aborted";
                prebuild.error =
                    "Project is inactive. Please start a new workspace for this project to re-enable prebuilds.";
                await this.workspaceDB.trace({ span }).storePrebuiltWorkspace(prebuild);
            } else {
                span.setTag("starting", true);
                await this.workspaceService.startWorkspace(
                    { span },
                    user,
                    workspace.id,
                    {
                        excludeFeatureFlags: ["full_workspace_backup"],
                    },
                    false,
                );
            }

            return { prebuildId: prebuild.id, wsid: workspace.id, done: false };
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    private async checkUsageLimitReached(user: User, organizationId: string): Promise<void> {
        let result: MayStartWorkspaceResult = {};
        try {
            result = await this.entitlementService.mayStartWorkspace(user, organizationId, Promise.resolve([]));
        } catch (err) {
            log.error({ userId: user.id }, "EntitlementService.mayStartWorkspace error", err);
            return; // we don't want to block workspace starts because of internal errors
        }
        if (!!result.usageLimitReachedOnCostCenter) {
            throw new ApplicationError(
                ErrorCodes.PAYMENT_SPENDING_LIMIT_REACHED,
                "Increase usage limit and try again.",
                {
                    organizationId,
                },
            );
        }
    }

    checkPrebuildPrecondition(params: { config: WorkspaceConfig; project: Project; context: CommitContext }): {
        shouldRun: boolean;
        reason: string;
    } {
        const { config, project, context } = params;
        if (!config || !config._origin || config._origin !== "repo") {
            // we demand an explicit gitpod config
            return { shouldRun: false, reason: "no-gitpod-config-in-repo" };
        }

        const hasPrebuildTask = !!config.tasks && config.tasks.find((t) => !!t.before || !!t.init || !!t.prebuild);
        if (!hasPrebuildTask) {
            return { shouldRun: false, reason: "no-tasks-in-gitpod-config" };
        }

        const prebuildSettings = Project.getPrebuildSettings(project);
        if (!prebuildSettings.enable) {
            return { shouldRun: false, reason: "prebuilds-not-enabled" };
        }

        if (prebuildSettings.branchStrategy === "all-branches") {
            return { shouldRun: true, reason: "all-branches-selected" };
        }

        if (prebuildSettings.branchStrategy === "default-branch") {
            const defaultBranch = context.repository.defaultBranch;
            if (!defaultBranch) {
                log.debug("CommitContext is missing the default branch. Ignoring request.", { context });
                return { shouldRun: false, reason: "default-branch-missing-in-commit-context" };
            }

            if (CommitContext.isDefaultBranch(context)) {
                return { shouldRun: true, reason: "default-branch-matched" };
            }
            return { shouldRun: false, reason: "default-branch-unmatched" };
        }

        if (prebuildSettings.branchStrategy === "matched-branches" && !!prebuildSettings.branchMatchingPattern) {
            const branchName = context.ref;
            if (!branchName) {
                log.debug("CommitContext is missing the branch name. Ignoring request.", { context });
                return { shouldRun: false, reason: "branch-name-missing-in-commit-context" };
            }

            for (let pattern of prebuildSettings.branchMatchingPattern.split(",")) {
                // prepending `**/` as branch names can be 'refs/heads/something/feature-x'
                // and we want to allow simple patterns like: `feature-*`
                pattern = "**/" + pattern.trim();
                try {
                    if (globMatch(branchName, pattern)) {
                        return { shouldRun: true, reason: "branch-matched" };
                    }
                } catch (error) {
                    log.debug("Ignored error with attempt to match a branch by pattern.", {
                        prebuildSettings,
                        error: error?.message,
                    });
                }
            }
            return { shouldRun: false, reason: "branch-unmatched" };
        }

        log.debug("Unknown prebuild branch strategy. Ignoring request.", { context, config });
        return { shouldRun: false, reason: "unknown-strategy" };
    }

    async fetchConfig(
        ctx: TraceContext,
        user: User,
        context: CommitContext,
        organizationId?: string,
    ): Promise<WorkspaceConfig> {
        const span = TraceContext.startSpan("fetchConfig", ctx);
        try {
            return (await this.configProvider.fetchConfig({ span }, user, context, organizationId)).config;
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    //TODO this doesn't belong so deep here. All this context should be stored on the surface not passed down.
    private async storePrebuildInfo(
        ctx: TraceContext,
        project: Project,
        pws: PrebuiltWorkspace,
        ws: Workspace,
        user: User,
        commit: CommitInfo,
    ) {
        const span = TraceContext.startSpan("storePrebuildInfo", ctx);
        const { teamId, name: projectName, id: projectId } = project;
        try {
            await this.workspaceDB.trace({ span }).storePrebuildInfo({
                id: pws.id,
                buildWorkspaceId: pws.buildWorkspaceId,
                basedOnPrebuildId: ws.basedOnPrebuildId,
                teamId,
                userId: user.id,
                projectName,
                projectId,
                startedAt: pws.creationTime,
                startedBy: "", // TODO
                startedByAvatar: "", // TODO
                cloneUrl: pws.cloneURL,
                branch: pws.branch || "unknown",
                changeAuthor: commit.author,
                changeAuthorAvatar: commit.authorAvatarUrl,
                changeDate: commit.authorDate || "",
                changeHash: commit.sha,
                changeTitle: commit.commitMessage,
                // changePR
                changeUrl: ws.contextURL,
            });
        } catch (err) {
            TraceContext.setError(ctx, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    private async shouldRateLimitPrebuild(span: opentracing.Span, project: Project): Promise<boolean> {
        const rateLimit = PrebuildRateLimiterConfig.getConfigForCloneURL(this.config.prebuildLimiter, project.cloneUrl);

        const windowStart = secondsBefore(new Date().toISOString(), rateLimit.period);
        const unabortedCount = await this.workspaceDB
            .trace({ span })
            .countUnabortedPrebuildsSince(project.id, new Date(windowStart));

        if (unabortedCount >= rateLimit.limit) {
            log.debug("Prebuild exceeds rate limit", {
                ...rateLimit,
                unabortedPrebuildsCount: unabortedCount,
                projectId: project.id,
            });
            return true;
        }
        return false;
    }

    public async watchPrebuildLogs(
        userId: string,
        prebuildId: string,
        taskId: string,
        onLog: (message: string) => Promise<void>,
    ): Promise<{ taskUrl: string } | undefined> {
        const prebuild = await this.getPrebuild({}, userId, prebuildId);
        const organizationId = prebuild?.info.teamId;
        if (!prebuild || !organizationId) {
            throw new ApplicationError(ErrorCodes.PRECONDITION_FAILED, "prebuild workspace not found");
        }
        await this.auth.checkPermissionOnOrganization(userId, "read_prebuild", organizationId);

        const instance = await this.workspaceService.getCurrentInstance(userId, prebuild.workspace.id);
        const urls = await this.workspaceService.getHeadlessLog(userId, instance.id, async () => {});

        const taskUrl = urls.streams[taskId];
        if (!taskUrl) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `no logs found for task ${taskId}`);
        }

        if (!urls.online) {
            // The workspace is no longer running, we want the client to go elsewhere to fetch the logs
            return {
                taskUrl,
            };
        }

        // Technically we could point the client to the stream directly, but can't because of our central authz approach
        await this.workspaceService.streamWorkspaceLogs(userId, instance.id, { taskId }, onLog);
    }
}
