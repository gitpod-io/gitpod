/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Server, Probot, Context } from "probot";
import { getPrivateKey } from "@probot/get-private-key";
import * as fs from "fs-extra";
import { injectable, inject } from "inversify";
import { Config } from "../config";
import {
    AppInstallationDB,
    TracedWorkspaceDB,
    DBWithTracing,
    UserDB,
    WorkspaceDB,
    ProjectDB,
    TeamDB,
    WebhookEventDB,
} from "@gitpod/gitpod-db/lib";
import express from "express";
import { log, LogContext, LogrusLogLevel } from "@gitpod/gitpod-protocol/lib/util/logging";
import {
    WorkspaceConfig,
    User,
    Project,
    StartPrebuildResult,
    CommitContext,
    CommitInfo,
} from "@gitpod/gitpod-protocol";
import { GithubAppRules } from "./github-app-rules";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { PrebuildManager } from "./prebuild-manager";
import { PrebuildStatusMaintainer } from "./prebuilt-status-maintainer";
import { Options, ApplicationFunctionOptions } from "probot/lib/types";
import { asyncHandler } from "../express-util";
import { ContextParser } from "../workspace/context-parser-service";
import { HostContextProvider } from "../auth/host-context-provider";
import { RepoURL } from "../repohost";
import { ApplicationError, ErrorCode } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { UserService } from "../user/user-service";
import { ProjectsService } from "../projects/projects-service";
import { SYSTEM_USER, SYSTEM_USER_ID } from "../authorization/authorizer";
import { runWithSubjectId, runWithRequestContext } from "../util/request-context";
import { SubjectId } from "../auth/subject-id";

/**
 * GitHub app urls:
 *    User authorization callback URL: https://gitpod.io/install-github-app
 *    Setup URL:                       https://gitpod.io/install-github-app
 *    Webhook URL:                     https://gitpod.io/apps/github
 *
 * Make sure that the webhook secret you set in GitHub matches what's in your
 * values.yaml file (GITPOD_GITHUB_APP_WEBHOOK_SECRET) - it's not a bad idea to
 * look at those values to begin with.
 */
@injectable()
export class GithubApp {
    constructor(
        @inject(Config) private readonly config: Config,
        @inject(PrebuildStatusMaintainer) private readonly statusMaintainer: PrebuildStatusMaintainer,
        @inject(ProjectDB) private readonly projectDB: ProjectDB,
        @inject(TeamDB) private readonly teamDB: TeamDB,
        @inject(UserDB) private readonly userDB: UserDB,
        @inject(AppInstallationDB) private readonly appInstallationDB: AppInstallationDB,
        @inject(UserService) private readonly userService: UserService,
        @inject(TracedWorkspaceDB) private readonly workspaceDB: DBWithTracing<WorkspaceDB>,
        @inject(GithubAppRules) private readonly appRules: GithubAppRules,
        @inject(PrebuildManager) private readonly prebuildManager: PrebuildManager,
        @inject(ContextParser) private readonly contextParser: ContextParser,
        @inject(HostContextProvider) private readonly hostCtxProvider: HostContextProvider,
        @inject(WebhookEventDB) private readonly webhookEvents: WebhookEventDB,
        @inject(ProjectsService) private readonly projectService: ProjectsService,
    ) {
        if (config.githubApp?.enabled) {
            const logLevel = LogrusLogLevel.getFromEnv() ?? "info";

            this.server = new Server({
                Probot: Probot.defaults({
                    appId: config.githubApp.appId,
                    privateKey: GithubApp.loadPrivateKey(config.githubApp.certPath),
                    secret: config.githubApp.webhookSecret,
                    logLevel: GithubApp.mapToGitHubLogLevel(logLevel),
                    baseUrl: config.githubApp.baseUrl,
                }),
            });
            log.debug("Starting GitHub app integration", {
                appId: config.githubApp.appId,
                cert: config.githubApp.certPath,
                secret: config.githubApp.webhookSecret,
            });

            this.server.load(this.buildApp.bind(this)).catch((err) => log.error("error loading probot server", err));
        }
    }
    readonly server: Server | undefined;

    private async buildApp(app: Probot, options: ApplicationFunctionOptions) {
        this.statusMaintainer.start(async (id) => {
            try {
                const githubApi = await app.auth(id);
                return githubApi;
            } catch (error) {
                log.error("Failes to authorize GH API for Probot", { error });
            }
        });

        // Backward-compatibility: Redirect old badge URLs (e.g. "/api/apps/github/pbs/github.com/gitpod-io/gitpod/5431d5735c32ab7d5d840a4d1a7d7c688d1f0ce9.svg")
        options.getRouter &&
            options
                .getRouter("/pbs")
                .get("/*", (req: express.Request, res: express.Response, next: express.NextFunction) => {
                    res.redirect(301, this.getBadgeImageURL());
                });

        app.on("installation.created", (ctx: Context<"installation.created">) => {
            handleEvent(ctx.name, async () => {
                const targetAccountName = `${ctx.payload.installation.account.login}`;
                const installationId = `${ctx.payload.installation.id}`;

                // cf. https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#installation
                const authId = `${ctx.payload.sender.id}`;

                const user = await this.userDB.findUserByIdentity({
                    authProviderId: this.config.githubApp?.authProviderId || "unknown",
                    authId,
                });
                const userId = user ? user.id : undefined;
                await this.appInstallationDB.recordNewInstallation(
                    "github",
                    "platform",
                    installationId,
                    userId,
                    authId,
                );
                log.debug({ userId }, "New installation recorded", { userId, authId, targetAccountName });
            });
        });
        app.on("installation.deleted", (ctx: Context<"installation.deleted">) => {
            handleEvent(ctx.name, async () => {
                const installationId = `${ctx.payload.installation.id}`;
                await this.appInstallationDB.recordUninstallation("github", "platform", installationId);
            });
        });

        app.on("repository.renamed", (ctx: Context<"repository.renamed">) => {
            handleEvent(ctx.name, async () => {
                const { action, repository, installation } = ctx.payload;
                if (!installation) {
                    return;
                }
                if (action === "renamed") {
                    // HINT(AT): This is undocumented, but the event payload contains something like
                    // "changes": { "repository": { "name": { "from": "test-repo-123" } } }
                    // To implement this in a more robust way, we'd need to store `repository.id` with the project, next to the cloneUrl.
                    const oldName = (ctx.payload as any)?.changes?.repository?.name?.from;
                    if (oldName) {
                        const projects = await runWithSubjectId(SYSTEM_USER, async () =>
                            this.projectService.findProjectsByCloneUrl(
                                SYSTEM_USER_ID,
                                `https://github.com/${repository.owner.login}/${oldName}.git`,
                            ),
                        );
                        for (const project of projects) {
                            project.cloneUrl = repository.clone_url;
                            await this.projectDB.storeProject(project);
                        }
                    }
                }
            });
            // TODO(at): handle deleted as well
        });

        app.on("push", (ctx: Context<"push">) => {
            handleEvent(ctx.name, () => this.handlePushEvent(ctx));
        });

        app.on(["pull_request.opened", "pull_request.synchronize", "pull_request.reopened"], (ctx) => {
            handleEvent(ctx.name, () => this.handlePullRequest(ctx));
        });

        options.getRouter &&
            options.getRouter("/reconfigure").get(
                "/",
                asyncHandler(async (req: express.Request, res: express.Response) => {
                    try {
                        const gh = await app.auth();
                        const data = await gh.apps.getAuthenticated();
                        const slug = data.data.slug;

                        const state = req.query.state;
                        res.redirect(`https://github.com/apps/${slug}/installations/new?state=${state}`);
                    } catch (error) {
                        console.error(error, { error });
                        res.status(500).send("GitHub App is not configured.");
                    }
                }),
            );
        options.getRouter &&
            options.getRouter("/setup").get("/", (req: express.Request, res: express.Response) => {
                const state = req.query.state;
                const installationId = req.query.installation_id;
                const setupAction = req.query.setup_action;
                const payload = { installationId, setupAction };
                req.query;

                if (state) {
                    const url = this.config.hostUrl
                        .with({
                            pathname: "/complete-auth",
                            search:
                                "message=payload:" + Buffer.from(JSON.stringify(payload), "utf-8").toString("base64"),
                        })
                        .toString();
                    res.redirect(url);
                } else {
                    const url = this.config.hostUrl
                        .with({ pathname: "install-github-app", search: `installation_id=${installationId}` })
                        .toString();
                    res.redirect(url);
                }
            });
    }

    private async findProjectOwner(project: Project, installationOwner: User): Promise<User> {
        const user = await this.selectUserForPrebuild(installationOwner, project);
        if (!user) {
            log.info(`Did not find user for installation. Probably an incomplete app installation.`, {
                repo: project.cloneUrl,
                project,
            });
            return installationOwner;
        }
        return user;
    }

    private async handlePushEvent(ctx: Context<"push">): Promise<void> {
        const span = TraceContext.startSpan("GithubApp.handlePushEvent", {});
        span.setTag("request", ctx.id);

        // trim commits to avoid DB pollution
        // https://github.com/gitpod-io/gitpod/issues/11578
        ctx.payload.head_commit = null;

        const event = await this.webhookEvents.createEvent({
            type: "push",
            status: "received",
            rawEvent: JSON.stringify(ctx.payload),
        });

        try {
            const installationId = ctx.payload.installation?.id;
            const installationOwner = await this.findInstallationOwner(installationId);
            if (!installationOwner) {
                log.info("Did not find user for installation. Probably an incomplete app installation.", {
                    repo: ctx.payload.repository,
                    installationId,
                });
                return;
            }
            if (!!installationOwner.blocked) {
                log.info(`Blocked user tried to start prebuild`, { repo: ctx.payload.repository });
                await this.webhookEvents.updateEvent(event.id, { status: "dismissed_unauthorized" });
                return;
            }
            const pl = ctx.payload;
            const branch = this.getBranchFromRef(pl.ref);
            if (!branch) {
                // This is a valid case if we receive a tag push, for instance.
                log.debug("Unable to get branch from ref", { ref: pl.ref });
                await this.webhookEvents.updateEvent(event.id, {
                    prebuildStatus: "ignored_unconfigured",
                    status: "processed",
                });
                return;
            }
            const logCtx: LogContext = { userId: installationOwner.id };

            const repo = pl.repository;
            const contextURL = `${repo.html_url}/tree/${branch}`;
            span.setTag("contextURL", contextURL);
            const context = (await this.contextParser.handle({ span }, installationOwner, contextURL)) as CommitContext;
            const projects = await runWithSubjectId(SYSTEM_USER, async () =>
                this.projectService.findProjectsByCloneUrl(SYSTEM_USER_ID, context.repository.cloneUrl),
            );
            for (const project of projects) {
                try {
                    const user = await this.findProjectOwner(project, installationOwner);
                    const config = await this.prebuildManager.fetchConfig({ span }, user, context, project?.teamId);

                    if (project.settings?.prebuilds?.triggerStrategy === "activity-based") {
                        await this.projectService.updateProject(user, {
                            id: project.id,
                            settings: {
                                ...project.settings,
                                prebuilds: {
                                    ...project.settings.prebuilds,
                                    triggerStrategy: "webhook-based",
                                },
                            },
                        });
                        log.info(`Reverted configuration ${project.id} to webhook-based prebuilds`);
                    }

                    await this.webhookEvents.updateEvent(event.id, {
                        authorizedUserId: user.id,
                        projectId: project.id,
                        cloneUrl: context.repository.cloneUrl,
                        branch: context.ref,
                        commit: context.revision,
                    });
                    const prebuildPrecondition = this.prebuildManager.checkPrebuildPrecondition({
                        config,
                        project,
                        context,
                    });

                    if (!prebuildPrecondition.shouldRun) {
                        const reason = `GitHub push event: No prebuild.`;
                        log.debug(logCtx, reason, { contextURL });
                        span.log({ "not-running": reason, config: config });
                        await this.webhookEvents.updateEvent(event.id, {
                            prebuildStatus: "ignored_unconfigured",
                            status: "processed",
                            message: prebuildPrecondition.reason,
                        });
                        continue;
                    }

                    await runWithSubjectId(SubjectId.fromUserId(user.id), async () => {
                        const commitInfo = await this.getCommitInfo(user, repo.html_url, ctx.payload.after);
                        this.prebuildManager
                            .startPrebuild({ span }, { user, context, project: project!, commitInfo })
                            .then(async (result) => {
                                if (!result.done) {
                                    await this.webhookEvents.updateEvent(event.id, {
                                        prebuildStatus: "prebuild_triggered",
                                        status: "processed",
                                        prebuildId: result.prebuildId,
                                    });
                                }
                            })
                            .catch(async (err) => {
                                log.error(logCtx, "Error while starting prebuild", err, { contextURL });
                                await this.webhookEvents.updateEvent(event.id, {
                                    prebuildStatus: "prebuild_trigger_failed",
                                    status: "processed",
                                });
                            });
                    });
                } catch (error) {
                    log.error("Error processing GitHub webhook event", error);
                }
            }
        } catch (e) {
            TraceContext.setError({ span }, e);
            await this.webhookEvents.updateEvent(event.id, {
                prebuildStatus: "prebuild_trigger_failed",
                status: "processed",
            });
            throw e;
        } finally {
            span.finish();
        }
    }

    private async getCommitInfo(user: User, repoURL: string, commitSHA: string) {
        const parsedRepo = RepoURL.parseRepoUrl(repoURL)!;
        const hostCtx = this.hostCtxProvider.get(parsedRepo.host);
        let commitInfo: CommitInfo | undefined;
        if (hostCtx?.services?.repositoryProvider) {
            commitInfo = await hostCtx?.services?.repositoryProvider.getCommitInfo(
                user,
                parsedRepo.owner,
                parsedRepo.repo,
                commitSHA,
            );
        }
        return commitInfo;
    }

    private getBranchFromRef(ref: string): string | undefined {
        const headsPrefix = "refs/heads/";
        if (ref.startsWith(headsPrefix)) {
            return ref.substring(headsPrefix.length);
        }

        return undefined;
    }

    private async handlePullRequest(
        ctx: Context<"pull_request.opened" | "pull_request.synchronize" | "pull_request.reopened">,
    ): Promise<void> {
        const span = TraceContext.startSpan("GithubApp.handlePullRequest", {});
        span.setTag("request", ctx.id);

        const event = await this.webhookEvents.createEvent({
            type: ctx.name,
            status: "received",
            rawEvent: JSON.stringify(ctx.payload),
        });

        try {
            const installationId = ctx.payload.installation?.id;
            const cloneURL = ctx.payload.repository.clone_url;
            // we are only interested in PRs that want to contribute to our repo
            if (ctx.payload.pull_request?.base?.repo?.clone_url !== cloneURL) {
                log.info("Ignoring inverse PR", ctx.payload.pull_request);
                return;
            }
            const pr = ctx.payload.pull_request;
            const contextURL = pr.html_url;
            const installationOwner = await this.findInstallationOwner(installationId);
            if (!installationOwner) {
                log.info("Did not find user for installation. Probably an incomplete app installation.", {
                    repo: ctx.payload.repository,
                    installationId,
                });
                return;
            }
            const context = (await this.contextParser.handle({ span }, installationOwner, contextURL)) as CommitContext;

            const projects = await runWithSubjectId(SubjectId.fromUserId(installationOwner.id), () =>
                this.projectService.findProjectsByCloneUrl(installationOwner.id, context.repository.cloneUrl),
            );
            for (const project of projects) {
                const user = await this.findProjectOwner(project, installationOwner);

                const config = await this.prebuildManager.fetchConfig({ span }, user, context, project?.teamId);

                await this.webhookEvents.updateEvent(event.id, {
                    authorizedUserId: user.id,
                    projectId: project?.id,
                    cloneUrl: context.repository.cloneUrl,
                    branch: context.ref,
                    commit: context.revision,
                });

                const prebuildStartResult = await this.onPrStartPrebuild({ span }, ctx, config, context, user, project);
                if (prebuildStartResult) {
                    await this.webhookEvents.updateEvent(event.id, {
                        prebuildStatus: "prebuild_triggered",
                        status: "processed",
                        prebuildId: prebuildStartResult.prebuildId,
                    });

                    await this.onPrAddCheck({ span }, config, ctx, prebuildStartResult);
                    this.onPrAddBadge(config, ctx);
                    await this.onPrAddComment(config, ctx);
                } else {
                    await this.webhookEvents.updateEvent(event.id, {
                        prebuildStatus: "ignored_unconfigured",
                        status: "processed",
                    });
                }
            }
        } catch (e) {
            TraceContext.setError({ span }, e);
            await this.webhookEvents.updateEvent(event.id, {
                prebuildStatus: "prebuild_trigger_failed",
                status: "processed",
            });
            throw e;
        } finally {
            span.finish();
        }
    }

    private async onPrAddCheck(
        tracecContext: TraceContext,
        config: WorkspaceConfig | undefined,
        ctx: Context<"pull_request.opened" | "pull_request.synchronize" | "pull_request.reopened">,
        start: StartPrebuildResult,
    ) {
        if (!start) {
            return;
        }

        if (!this.appRules.shouldDo(config, "addCheck")) {
            return;
        }

        const span = TraceContext.startSpan("onPrAddCheck", tracecContext);
        try {
            const pws = await this.workspaceDB.trace({ span }).findPrebuildByWorkspaceID(start.wsid);
            if (!pws) {
                return;
            }

            const installationId = ctx.payload.installation?.id;
            if (!installationId) {
                log.info("Did not find user for installation. Probably an incomplete app installation.", {
                    repo: ctx.payload.repository,
                    installationId,
                });
                return;
            }
            await this.statusMaintainer.registerCheckRun(
                { span },
                installationId,
                pws,
                {
                    ...ctx.repo(),
                    head_sha: ctx.payload.pull_request.head.sha,
                    details_url: this.config.hostUrl.withContext(ctx.payload.pull_request.html_url).toString(),
                },
                config,
            );
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    private async onPrStartPrebuild(
        tracecContext: TraceContext,
        ctx: Context<"pull_request.opened" | "pull_request.synchronize" | "pull_request.reopened">,
        config: WorkspaceConfig,
        context: CommitContext,
        user: User,
        project: Project,
    ): Promise<StartPrebuildResult | undefined> {
        const pr = ctx.payload.pull_request;
        const contextURL = pr.html_url;

        const isFork = pr.head.repo.id !== pr.base.repo.id;
        if (isFork) {
            log.debug({ userId: user.id }, `GitHub PR event from fork.`, {
                contextURL,
                userId: user.id,
                project,
                isFork,
            });
            return;
        }

        const prebuildPrecondition = this.prebuildManager.checkPrebuildPrecondition({ config, project, context });
        if (prebuildPrecondition.shouldRun) {
            const result = await runWithSubjectId(SubjectId.fromUserId(user.id), async () => {
                const commitInfo = await this.getCommitInfo(user, ctx.payload.repository.html_url, pr.head.sha);
                return await this.prebuildManager.startPrebuild(tracecContext, {
                    user,
                    context,
                    project: project!,
                    commitInfo,
                });
            });
            if (result?.done) {
                return undefined;
            }
            return result;
        } else {
            log.debug({ userId: user.id }, `GitHub push event: No prebuild.`, {
                contextURL,
                userId: user.id,
                project,
            });
            return;
        }
    }

    private onPrAddBadge(
        config: WorkspaceConfig | undefined,
        ctx: Context<"pull_request.opened" | "pull_request.synchronize" | "pull_request.reopened">,
    ) {
        if (!this.appRules.shouldDo(config, "addBadge")) {
            // we shouldn't add (or update) a button here
            return;
        }

        const pr = ctx.payload.pull_request;
        const contextURL = pr.html_url;
        const body: string | null = pr.body;
        if (!body) {
            return;
        }
        const button = `<a href="${this.config.hostUrl.withContext(
            contextURL,
        )}"><img src="${this.getBadgeImageURL()}"/></a>`;
        if (body.includes(button)) {
            // the button is already in the comment
            return;
        }

        const newBody = body + `\n\n${button}\n\n`;
        const updatePrPromise = ctx.octokit.pulls.update({ ...ctx.repo(), pull_number: pr.number, body: newBody });
        updatePrPromise.catch((err) => log.error("Error while updating PR body", err, { contextURL }));
    }

    private async onPrAddComment(
        config: WorkspaceConfig | undefined,
        ctx: Context<"pull_request.opened" | "pull_request.synchronize" | "pull_request.reopened">,
    ) {
        if (!this.appRules.shouldDo(config, "addComment")) {
            return;
        }

        const pr = ctx.payload.pull_request;
        const contextURL = pr.html_url;
        const button = `<a href="${this.config.hostUrl.withContext(
            contextURL,
        )}"><img src="${this.getBadgeImageURL()}"/></a>`;
        const comments = await ctx.octokit.issues.listComments(ctx.issue());
        const existingComment = comments.data.find((c: any) => c.body.indexOf(button) > -1);
        if (existingComment) {
            return;
        }

        const newComment = ctx.issue({ body: `\n\n${button}\n\n` });
        const newCommentPromise = ctx.octokit.issues.createComment(newComment);
        newCommentPromise.catch((err) => log.error("Error while adding new PR comment", err, { contextURL }));
    }

    private getBadgeImageURL(): string {
        return this.config.hostUrl.with({ pathname: "/button/open-in-gitpod.svg" }).toString();
    }

    /**
     * Finds the relevant user account to create a prebuild with.
     *
     * First it tries to find the installer of the GitHub App installation
     * among the members of the project team. As a fallback, it tries so pick
     * any of the team members which also has a github.com connection.
     *
     * For projects under a personal account, it simply returns the installer.
     *
     * @param installationOwner given user account of the GitHub App installation
     * @param project the project associated with the `cloneURL`
     * @returns a promise that resolves to a `User` or undefined
     */
    private async selectUserForPrebuild(installationOwner?: User, project?: Project): Promise<User | undefined> {
        if (!project) {
            return installationOwner;
        }
        if (!project.teamId) {
            return installationOwner;
        }
        const teamMembers = await this.teamDB.findMembersByTeam(project.teamId);
        if (!!installationOwner && teamMembers.some((t) => t.userId === installationOwner.id)) {
            return installationOwner;
        }
        for (const teamMember of teamMembers) {
            const user = await runWithSubjectId(SubjectId.fromUserId(teamMember.userId), () =>
                this.userService.findUserById(teamMember.userId, teamMember.userId),
            );
            if (user && user.identities.some((i) => i.authProviderId === "Public-GitHub")) {
                return user;
            }
        }
    }

    /**
     *
     * @param installationId read from webhook event
     * @returns the user account of the GitHub App installation
     */
    private async findInstallationOwner(installationId?: number): Promise<User | undefined> {
        if (!installationId) {
            return;
        }
        // Legacy mode
        //
        const installation = await this.appInstallationDB.findInstallation("github", String(installationId));
        if (!installation) {
            return;
        }

        const ownerID = installation.ownerUserID || "this-should-never-happen";
        const user = await this.userService.findUserById(ownerID, ownerID);
        if (!user) {
            return;
        }

        return user;
    }
}

function handleEvent(eventName: string, p: () => Promise<any>): void {
    runWithRequestContext(
        {
            requestKind: "probot",
            requestMethod: eventName,
            signal: new AbortController().signal,
        },
        () => {
            p().catch((err) => {
                let logger = log.error;
                if (ApplicationError.hasErrorCode(err)) {
                    logger = ErrorCode.isUserError(err.code) ? log.info : log.error;
                }

                logger("Failed to handle github event", err);
            });
        },
    );
}

export namespace GithubApp {
    export function loadPrivateKey(filename: string | undefined): string | undefined {
        if (!filename) {
            return;
        }

        const isInTelepresence = !!process.env.TELEPRESENCE_ROOT;
        const ignoreTelepresence = !!process.env.TELEPRESENCE_ROOT_IGNORE;
        if (isInTelepresence && !ignoreTelepresence) {
            filename = `${process.env.TELEPRESENCE_ROOT}/${filename}`;
        }

        // loadPrivateKey is used in super call - must not be async
        if (fs.existsSync(filename)) {
            const key = getPrivateKey({ filepath: filename });
            if (key) {
                return key.toString();
            }
        }
    }

    export function mapToGitHubLogLevel(logLevel: LogrusLogLevel): Options["logLevel"] {
        switch (logLevel) {
            case "warning":
                return "warn";
            case "panic":
                return "fatal";
            default:
                return logLevel;
        }
    }
}
