/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DBWithTracing, TeamDB, TracedWorkspaceDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import {
    CommitContext,
    CommitInfo,
    PrebuiltWorkspace,
    Project,
    StartPrebuildContext,
    StartPrebuildResult,
    TaskConfig,
    User,
    Workspace,
    WorkspaceConfig,
    WorkspaceInstance,
} from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { getCommitInfo, HostContextProvider } from "../auth/host-context-provider";
import { WorkspaceFactory } from "../workspace/workspace-factory";
import { ConfigProvider } from "../workspace/config-provider";
import { WorkspaceStarter } from "../workspace/workspace-starter";
import { Config } from "../config";
import { ProjectsService } from "../projects/projects-service";
import { secondsBefore } from "@gitpod/gitpod-protocol/lib/util/timeutil";

import { inject, injectable } from "inversify";
import * as opentracing from "opentracing";
import { StopWorkspacePolicy } from "@gitpod/ws-manager/lib";
import { error } from "console";
import { IncrementalPrebuildsService } from "./incremental-prebuilds-service";
import { PrebuildRateLimiterConfig } from "../workspace/prebuild-rate-limiter";
import { ErrorCodes, ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { UserAuthentication } from "../user/user-authentication";
import { EntitlementService, MayStartWorkspaceResult } from "../billing/entitlement-service";
import { EnvVarService } from "../workspace/env-var-service";

export class WorkspaceRunningError extends Error {
    constructor(msg: string, public instance: WorkspaceInstance) {
        super(msg);
    }
}

export interface StartPrebuildParams {
    user: User;
    context: CommitContext;
    project?: Project;
    commitInfo?: CommitInfo;
    forcePrebuild?: boolean;
}

@injectable()
export class PrebuildManager {
    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;
    @inject(WorkspaceFactory) protected readonly workspaceFactory: WorkspaceFactory;
    @inject(WorkspaceStarter) protected readonly workspaceStarter: WorkspaceStarter;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(ConfigProvider) protected readonly configProvider: ConfigProvider;
    @inject(Config) protected readonly config: Config;
    @inject(ProjectsService) protected readonly projectService: ProjectsService;
    @inject(IncrementalPrebuildsService) protected readonly incrementalPrebuildsService: IncrementalPrebuildsService;
    @inject(UserAuthentication) protected readonly userService: UserAuthentication;
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(EntitlementService) protected readonly entitlementService: EntitlementService;
    @inject(EnvVarService) private readonly envVarService: EnvVarService;

    async abortPrebuildsForBranch(ctx: TraceContext, project: Project, user: User, branch: string): Promise<void> {
        const span = TraceContext.startSpan("abortPrebuildsForBranch", ctx);
        try {
            const prebuilds = await this.workspaceDB
                .trace({ span })
                .findActivePrebuiltWorkspacesByBranch(project.id, branch);
            const results: Promise<any>[] = [];
            for (const prebuild of prebuilds) {
                try {
                    for (const instance of prebuild.instances) {
                        log.info(
                            { userId: user.id, instanceId: instance.id, workspaceId: instance.workspaceId },
                            "Cancelling Prebuild workspace because a newer commit was pushed to the same branch.",
                        );
                        results.push(
                            this.workspaceStarter.stopWorkspaceInstance(
                                { span },
                                instance.id,
                                instance.region,
                                "prebuild cancelled because a newer commit was pushed to the same branch",
                                StopWorkspacePolicy.ABORT,
                            ),
                        );
                    }
                    prebuild.prebuild.state = "aborted";
                    prebuild.prebuild.error = "A newer commit was pushed to the same branch.";
                    results.push(this.workspaceDB.trace({ span }).storePrebuiltWorkspace(prebuild.prebuild));
                } catch (err) {
                    error("Cannot cancel prebuild", { prebuildID: prebuild.prebuild.id }, err);
                }
            }
            await Promise.all(results);
        } finally {
            span.finish();
        }
    }

    protected async findNonFailedPrebuiltWorkspace(ctx: TraceContext, cloneURL: string, commitSHA: string) {
        const existingPB = await this.workspaceDB.trace(ctx).findPrebuiltWorkspaceByCommit(cloneURL, commitSHA);

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

    async startPrebuild(
        ctx: TraceContext,
        { context, project, user, commitInfo, forcePrebuild }: StartPrebuildParams,
    ): Promise<StartPrebuildResult> {
        const span = TraceContext.startSpan("startPrebuild", ctx);
        const cloneURL = context.repository.cloneUrl;
        const commitSHAIdentifier = CommitContext.computeHash(context);
        span.setTag("cloneURL", cloneURL);
        span.setTag("commit", commitInfo?.sha);

        try {
            if (user.blocked) {
                throw new ApplicationError(
                    ErrorCodes.USER_BLOCKED,
                    `Blocked users cannot start prebuilds (${user.name})`,
                );
            }
            if (!project) {
                throw new ApplicationError(
                    ErrorCodes.PROJECT_REQUIRED,
                    `Running prebuilds without a project is no longer supported. Please add '${cloneURL}' as a project in a team.`,
                );
            }
            await this.checkUsageLimitReached(user, project.teamId); // throws if out of credits

            const config = await this.fetchConfig({ span }, user, context);

            if (!forcePrebuild) {
                // Check for an existing, successful prebuild, before triggering a new one.
                const existingPB = await this.findNonFailedPrebuiltWorkspace({ span }, cloneURL, commitSHAIdentifier);
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
            if (context.ref && !project.settings?.keepOutdatedPrebuildsRunning) {
                try {
                    await this.abortPrebuildsForBranch({ span }, project, user, context.ref);
                } catch (e) {
                    console.error("Error aborting prebuilds", e);
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

            const prebuildEveryNthCommit = project?.settings?.prebuildEveryNthCommit || 0;
            if (!forcePrebuild && prebuildEveryNthCommit > 0) {
                const history = {
                    commitHistory: commitHistory?.slice(0, prebuildEveryNthCommit),
                    additionalRepositoryCommitHistories: additionalRepositoryCommitHistories?.map((repoHist) => ({
                        cloneUrl: repoHist.cloneUrl,
                        commitHistory: repoHist.commitHistory.slice(0, prebuildEveryNthCommit),
                    })),
                };
                const prebuild = await this.incrementalPrebuildsService.findGoodBaseForIncrementalBuild(
                    context,
                    config,
                    history,
                    user,
                );
                if (prebuild) {
                    return { prebuildId: prebuild.id, wsid: prebuild.buildWorkspaceId, done: true };
                }
            } else if (this.shouldPrebuildIncrementally(context.repository.cloneUrl, project)) {
                // We store the commit histories in the `StartPrebuildContext` in order to pass them down to
                // `WorkspaceFactoryEE.createForStartPrebuild`.
                if (commitHistory) {
                    prebuildContext.commitHistory = commitHistory;
                }
                if (additionalRepositoryCommitHistories) {
                    prebuildContext.additionalRepositoryCommitHistories = additionalRepositoryCommitHistories;
                }
            }

            const workspace = await this.workspaceFactory.createForContext(
                { span },
                user,
                project.teamId,
                project,
                prebuildContext,
                context.normalizedContextURL!,
            );

            const envVarsPromise = this.envVarService.resolve(workspace);

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

            if (await this.shouldRateLimitPrebuild(span, cloneURL)) {
                prebuild.state = "aborted";
                prebuild.error =
                    "Prebuild is rate limited. Please contact Gitpod if you believe this happened in error.";
                await this.workspaceDB.trace({ span }).storePrebuiltWorkspace(prebuild);
                span.setTag("ratelimited", true);
            } else if (project && (await this.shouldSkipInactiveProject(user.id, project))) {
                prebuild.state = "aborted";
                prebuild.error =
                    "Project is inactive. Please start a new workspace for this project to re-enable prebuilds.";
                await this.workspaceDB.trace({ span }).storePrebuiltWorkspace(prebuild);
            } else if (!project && (await this.shouldSkipInactiveRepository({ span }, cloneURL))) {
                prebuild.state = "aborted";
                prebuild.error =
                    "Repository is inactive. Please create a project for this repository to re-enable prebuilds.";
                await this.workspaceDB.trace({ span }).storePrebuiltWorkspace(prebuild);
            } else {
                span.setTag("starting", true);
                const envVars = await envVarsPromise;
                await this.workspaceStarter.startWorkspace({ span }, workspace, user, project, envVars, {
                    excludeFeatureFlags: ["full_workspace_backup"],
                });
            }

            return { prebuildId: prebuild.id, wsid: workspace.id, done: false };
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    protected async checkUsageLimitReached(user: User, organizationId: string): Promise<void> {
        let result: MayStartWorkspaceResult = {};
        try {
            result = await this.entitlementService.mayStartWorkspace(
                user,
                organizationId,
                new Date(),
                Promise.resolve([]),
            );
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

    async retriggerPrebuild(
        ctx: TraceContext,
        user: User,
        project: Project | undefined,
        workspaceId: string,
    ): Promise<StartPrebuildResult> {
        const span = TraceContext.startSpan("retriggerPrebuild", ctx);
        span.setTag("workspaceId", workspaceId);
        try {
            const workspacePromise = this.workspaceDB.trace({ span }).findById(workspaceId);
            const prebuildPromise = this.workspaceDB.trace({ span }).findPrebuildByWorkspaceID(workspaceId);
            const runningInstance = await this.workspaceDB.trace({ span }).findRunningInstance(workspaceId);
            if (runningInstance !== undefined) {
                throw new WorkspaceRunningError("Workspace is still runnning", runningInstance);
            }
            span.setTag("starting", true);
            const workspace = await workspacePromise;
            if (!workspace) {
                console.error("Unknown workspace id.", { workspaceId });
                throw new Error("Unknown workspace " + workspaceId);
            }
            const prebuild = await prebuildPromise;
            if (!prebuild) {
                throw new Error("No prebuild found for workspace " + workspaceId);
            }
            const envVars = await this.envVarService.resolve(workspace);
            await this.workspaceStarter.startWorkspace({ span }, workspace, user, project, envVars);
            return { prebuildId: prebuild.id, wsid: workspace.id, done: false };
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    shouldPrebuild(config: WorkspaceConfig | undefined): boolean {
        if (!config || !config._origin || config._origin !== "repo") {
            // we demand an explicit gitpod config
            return false;
        }

        const hasPrebuildTask = !!config.tasks && config.tasks.find((t) => !!t.before || !!t.init || !!t.prebuild);
        if (!hasPrebuildTask) {
            return false;
        }

        return true;
    }

    protected shouldPrebuildIncrementally(cloneUrl: string, project?: Project): boolean {
        if (project?.settings?.useIncrementalPrebuilds) {
            return true;
        }
        const trimRepoUrl = (url: string) => url.replace(/\/$/, "").replace(/\.git$/, "");
        const repoUrl = trimRepoUrl(cloneUrl);
        return this.config.incrementalPrebuilds.repositoryPasslist.some((url) => trimRepoUrl(url) === repoUrl);
    }

    async fetchConfig(ctx: TraceContext, user: User, context: CommitContext): Promise<WorkspaceConfig> {
        const span = TraceContext.startSpan("fetchConfig", ctx);
        try {
            return (await this.configProvider.fetchConfig({ span }, user, context)).config;
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    //TODO this doesn't belong so deep here. All this context should be stored on the surface not passed down.
    protected async storePrebuildInfo(
        ctx: TraceContext,
        project: Project,
        pws: PrebuiltWorkspace,
        ws: Workspace,
        user: User,
        commit: CommitInfo,
    ) {
        const span = TraceContext.startSpan("storePrebuildInfo", ctx);
        const { userId, teamId, name: projectName, id: projectId } = project;
        try {
            await this.workspaceDB.trace({ span }).storePrebuildInfo({
                id: pws.id,
                buildWorkspaceId: pws.buildWorkspaceId,
                basedOnPrebuildId: ws.basedOnPrebuildId,
                teamId,
                userId,
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

    private async shouldRateLimitPrebuild(span: opentracing.Span, cloneURL: string): Promise<boolean> {
        const rateLimit = PrebuildRateLimiterConfig.getConfigForCloneURL(this.config.prebuildLimiter, cloneURL);

        const windowStart = secondsBefore(new Date().toISOString(), rateLimit.period);
        const unabortedCount = await this.workspaceDB
            .trace({ span })
            .countUnabortedPrebuildsSince(cloneURL, new Date(windowStart));

        if (unabortedCount >= rateLimit.limit) {
            log.debug("Prebuild exceeds rate limit", {
                ...rateLimit,
                unabortedPrebuildsCount: unabortedCount,
                cloneURL,
            });
            return true;
        }
        return false;
    }

    private async shouldSkipInactiveProject(userID: string, project: Project): Promise<boolean> {
        return await this.projectService.isProjectConsideredInactive(userID, project.id);
    }

    private async shouldSkipInactiveRepository(ctx: TraceContext, cloneURL: string): Promise<boolean> {
        const span = TraceContext.startSpan("shouldSkipInactiveRepository", ctx);
        const { inactivityPeriodForReposInDays } = this.config;
        if (!inactivityPeriodForReposInDays) {
            // skipping is disabled if `inactivityPeriodForReposInDays` is not set
            span.finish();
            return false;
        }
        try {
            return (
                (await this.workspaceDB
                    .trace({ span })
                    .getWorkspaceCountByCloneURL(cloneURL, inactivityPeriodForReposInDays /* in days */, "regular")) ===
                0
            );
        } catch (error) {
            log.error("cannot compute activity for repository", { cloneURL }, error);
            TraceContext.setError(ctx, error);
            return false;
        } finally {
            span.finish();
        }
    }
}
