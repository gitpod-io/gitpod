/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import express from "express";
import { postConstruct, injectable, inject } from "inversify";
import { TeamDB, WebhookEventDB } from "@gitpod/gitpod-db/lib";
import { Project, User, CommitContext, CommitInfo, WebhookEvent } from "@gitpod/gitpod-protocol";
import { PrebuildManager } from "./prebuild-manager";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { TokenService } from "../user/token-service";
import { HostContextProvider } from "../auth/host-context-provider";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { ContextParser } from "../workspace/context-parser-service";
import { RepoURL } from "../repohost";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { UserService } from "../user/user-service";
import { ProjectsService } from "../projects/projects-service";
import { runWithSubjectId } from "../util/request-context";
import { SubjectId } from "../auth/subject-id";
import { SYSTEM_USER, SYSTEM_USER_ID } from "../authorization/authorizer";
import { PREBUILD_TOKEN_SCOPE } from "./constants";

@injectable()
export class GitLabApp {
    constructor(
        @inject(UserService) private readonly userService: UserService,
        @inject(PrebuildManager) private readonly prebuildManager: PrebuildManager,
        @inject(HostContextProvider) private readonly hostCtxProvider: HostContextProvider,
        @inject(TeamDB) private readonly teamDB: TeamDB,
        @inject(ContextParser) private readonly contextParser: ContextParser,
        @inject(WebhookEventDB) private readonly webhookEvents: WebhookEventDB,
        @inject(ProjectsService) private readonly projectService: ProjectsService,
    ) {}

    private _router = express.Router();
    public static path = "/apps/gitlab/";

    @postConstruct()
    protected init() {
        /**
         * see https://docs.gitlab.com/ee/user/project/integrations/webhooks.html#configure-your-webhook-receiver-endpoint
         * for recommendation on creating webhook receivers:
         *
         *  - ignore unrecognized event payloads
         *  - never return 500 status responses if the event has been handled
         *  - prefer to return 200; indicate that the webhook is asynchronous by returning 201
         *  - to support fast response times, perform I/O or computationally intensive operations asynchronously
         *  - if a webhook fails repeatedly, it may be disabled automatically
         *  - webhooks that return failure codes in the 4xx range are understood to be misconfigured, and these are disabled (permanently)
         */
        this._router.post("/", async (req, res) => {
            const eventType = req.header("X-Gitlab-Event");
            const secretToken = req.header("X-Gitlab-Token");
            const context = req.body as GitLabPushHook;

            // trim commits to avoid DB pollution
            // https://github.com/gitpod-io/gitpod/issues/11578
            context.commits = [];

            const event = await this.webhookEvents.createEvent({
                type: "push",
                status: "received",
                rawEvent: JSON.stringify(req.body),
            });

            if (eventType !== "Push Hook" || !secretToken) {
                log.warn("Unhandled GitLab event.", { event: eventType, secretToken: !!secretToken });
                res.status(200).send("Unhandled event.");
                await this.webhookEvents.updateEvent(event.id, { status: "ignored" });
                return;
            }

            const span = TraceContext.startSpan("GitLapApp.handleEvent", {});
            span.setTag("request", context);
            log.debug("GitLab push event received.", { event: eventType, context });
            let user: User | undefined;
            try {
                user = await this.findUser({ span }, context, secretToken);
            } catch (error) {
                log.error("Cannot find user.", error, { context });
                TraceContext.setError({ span }, error);
            }
            if (!user) {
                // webhooks are not supposed to return 4xx codes on application issues.
                // sending "Unauthorized" as content to support inspection of webhook delivery logs.
                span.finish();
                res.status(200).send("Unauthorized.");
                await this.webhookEvents.updateEvent(event.id, { status: "dismissed_unauthorized" });
                // TODO(at) explore ways to mark a project having issues with permissions.
                return;
            }
            /** no await */ this.handlePushHook({ span }, context, user, event).catch((error) => {
                console.error(`Couldn't handle request.`, error, { headers: req.headers });
                TraceContext.setError({ span }, error);
            });

            span.finish();
            res.status(201).send("Prebuild request handled.");
        });
    }

    private async findUser(ctx: TraceContext, context: GitLabPushHook, secretToken: string): Promise<User> {
        const span = TraceContext.startSpan("GitLapApp.findUser", ctx);
        try {
            const [userid, tokenValue] = secretToken.split("|");
            const user = await this.userService.findUserById(userid, userid);
            if (!user) {
                throw new Error("No user found for " + secretToken + " found.");
            } else if (!!user.blocked) {
                throw new Error(`Blocked user ${user.id} tried to start prebuild.`);
            }
            const identity = user.identities.find((i) => i.authProviderId === TokenService.GITPOD_AUTH_PROVIDER_ID);
            if (!identity) {
                throw new Error(`User ${user.id} has no identity for '${TokenService.GITPOD_AUTH_PROVIDER_ID}'.`);
            }
            const tokens = await this.userService.findTokensForIdentity(userid, identity);
            const token = tokens.find((t) => t.token.value === tokenValue);
            if (!token) {
                throw new Error(`User ${user.id} has no token with given value.`);
            }
            if (
                !token.token.scopes.includes(PREBUILD_TOKEN_SCOPE) ||
                !token.token.scopes.includes(context.repository.git_http_url)
            ) {
                throw new Error(
                    `The provided token is not valid for the repository ${context.repository.git_http_url}.`,
                );
            }
            return user;
        } finally {
            span.finish();
        }
    }

    private async handlePushHook(
        ctx: TraceContext,
        body: GitLabPushHook,
        user: User,
        event: WebhookEvent,
    ): Promise<void> {
        const span = TraceContext.startSpan("GitLapApp.handlePushHook", ctx);
        try {
            const cloneUrl = this.getCloneUrl(body);
            const projects = await runWithSubjectId(SYSTEM_USER, () =>
                this.projectService.findProjectsByCloneUrl(SYSTEM_USER_ID, cloneUrl),
            );
            for (const project of projects) {
                try {
                    const projectOwner = await this.findProjectOwner(project, user);

                    if (project.settings?.prebuilds?.triggerStrategy === "activity-based") {
                        await this.projectService.updateProject(projectOwner, {
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

                    const contextURL = this.createBranchContextUrl(body);
                    log.debug({ userId: user.id }, "GitLab push hook: Context URL", { context: body, contextURL });
                    span.setTag("contextURL", contextURL);
                    const context = (await this.contextParser.handle({ span }, user, contextURL)) as CommitContext;

                    await this.webhookEvents.updateEvent(event.id, {
                        authorizedUserId: user.id,
                        projectId: project?.id,
                        cloneUrl: context.repository.cloneUrl,
                        branch: context.ref,
                        commit: context.revision,
                    });

                    const config = await this.prebuildManager.fetchConfig({ span }, user, context, project?.teamId);
                    const prebuildPrecondition = this.prebuildManager.checkPrebuildPrecondition({
                        config,
                        project,
                        context,
                    });
                    if (!prebuildPrecondition.shouldRun) {
                        log.info("GitLab push event: No prebuild.", { config, context });
                        await this.webhookEvents.updateEvent(event.id, {
                            prebuildStatus: "ignored_unconfigured",
                            status: "processed",
                            message: prebuildPrecondition.reason,
                        });
                        continue;
                    }

                    log.debug({ userId: user.id }, "GitLab push event: Starting prebuild", { body, contextURL });

                    const workspaceUser = projectOwner || user;
                    await runWithSubjectId(SubjectId.fromUserId(workspaceUser.id), async () => {
                        const commitInfo = await this.getCommitInfo(user, body.repository.git_http_url, body.after);
                        const ws = await this.prebuildManager.startPrebuild(
                            { span },
                            {
                                user: workspaceUser,
                                project: project,
                                context,
                                commitInfo,
                            },
                        );
                        await this.webhookEvents.updateEvent(event.id, {
                            prebuildStatus: "prebuild_triggered",
                            status: "processed",
                            prebuildId: ws.prebuildId,
                        });
                    });
                } catch (error) {
                    log.error("Error processing GitLab webhook event", error);
                }
            }
        } catch (e) {
            log.error("Error processing GitLab webhook event", e, body);
            await this.webhookEvents.updateEvent(event.id, {
                prebuildStatus: "prebuild_trigger_failed",
                status: "processed",
            });
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

    /**
     * Finds the relevant user account and project to the provided webhook event information.
     *
     * First of all it tries to find the project for the given `cloneURL`, then it tries to
     * find the installer, which is also supposed to be a team member. As a fallback, it
     * looks for a team member which also has a gitlab.com connection.
     *
     * @param cloneURL of the webhook event
     * @param webhookInstaller the user account known from the webhook installation
     * @returns a promise which resolves to a user account and an optional project.
     */
    private async findProjectOwner(project: Project, webhookInstaller: User): Promise<User> {
        try {
            if (!project.teamId) {
                throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "Project has no teamId.");
            }
            const teamMembers = await this.teamDB.findMembersByTeam(project.teamId || "");
            if (teamMembers.some((t) => t.userId === webhookInstaller.id)) {
                return webhookInstaller;
            }
            for (const teamMember of teamMembers) {
                const user = await runWithSubjectId(SubjectId.fromUserId(teamMember.userId), () =>
                    this.userService.findUserById(teamMember.userId, teamMember.userId),
                );
                if (user && user.identities.some((i) => i.authProviderId === "Public-GitLab")) {
                    return user;
                }
            }
        } catch (err) {
            log.info({ userId: webhookInstaller.id }, "Failed to find project and owner", err);
        }
        return webhookInstaller;
    }

    private createBranchContextUrl(body: GitLabPushHook) {
        const repoUrl = body.repository.git_http_url;
        const contextURL = `${repoUrl.substr(0, repoUrl.length - 4)}/-/tree${body.ref.substr("refs/head/".length)}`;
        return contextURL;
    }

    private getCloneUrl(body: GitLabPushHook) {
        return body.repository.git_http_url;
    }

    get router(): express.Router {
        return this._router;
    }
}

interface GitLabPushHook {
    object_kind: "push";
    before: string;
    after: string; // commit
    ref: string; // e.g. "refs/heads/master"
    user_avatar: string;
    user_name: string;
    project: GitLabProject;
    repository: GitLabRepository;
    commits: GitLabCommit[];
}

interface GitLabCommit {
    id: string;
    title: string;
    message: string;
    url: string;
    author: {
        name: string;
        email: string;
    };
    // modified
    // added
    // removed
}

interface GitLabRepository {
    name: string;
    git_http_url: string; // e.g. http://example.com/mike/diaspora.git
    visibility_level: number;
}

interface GitLabProject {
    id: number;
    namespace: string;
    name: string;
    path_with_namespace: string; // e.g. "mike/diaspora"
    git_http_url: string; // e.g. http://example.com/mike/diaspora.git
    web_url: string; // e.g. http://example.com/mike/diaspora
    visibility_level: number;
    avatar_url: string | null;
}
