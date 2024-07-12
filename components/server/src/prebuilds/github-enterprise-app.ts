/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import express from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { Buffer } from "buffer";
import { postConstruct, injectable, inject } from "inversify";
import { TeamDB, WebhookEventDB } from "@gitpod/gitpod-db/lib";
import { PrebuildManager } from "./prebuild-manager";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { TokenService } from "../user/token-service";
import { HostContextProvider } from "../auth/host-context-provider";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { CommitContext, CommitInfo, Project, User, WebhookEvent } from "@gitpod/gitpod-protocol";
import { URL } from "url";
import { ContextParser } from "../workspace/context-parser-service";
import { RepoURL } from "../repohost";
import { UserService } from "../user/user-service";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { ProjectsService } from "../projects/projects-service";
import { SYSTEM_USER, SYSTEM_USER_ID } from "../authorization/authorizer";
import { runWithSubjectId } from "../util/request-context";
import { SubjectId } from "../auth/subject-id";
import { PREBUILD_TOKEN_SCOPE } from "./constants";

@injectable()
export class GitHubEnterpriseApp {
    constructor(
        @inject(UserService) private readonly userService: UserService,
        @inject(PrebuildManager) private readonly prebuildManager: PrebuildManager,
        @inject(HostContextProvider) private readonly hostContextProvider: HostContextProvider,
        @inject(TeamDB) private readonly teamDB: TeamDB,
        @inject(ContextParser) private readonly contextParser: ContextParser,
        @inject(WebhookEventDB) private readonly webhookEvents: WebhookEventDB,
        @inject(ProjectsService) private readonly projectService: ProjectsService,
    ) {}

    private _router = express.Router();
    public static path = "/apps/ghe/";

    @postConstruct()
    protected init() {
        this._router.post("/", async (req, res) => {
            const event = req.header("X-Github-Event");
            if (event === "push") {
                const payload = req.body as GitHubEnterprisePushPayload;
                const span = TraceContext.startSpan("GitHubEnterpriseApp.handleEvent", {});
                span.setTag("payload", payload);
                const event = await this.webhookEvents.createEvent({
                    type: "push",
                    status: "received",
                    rawEvent: JSON.stringify(req.body),
                });

                let user: User | undefined;
                try {
                    user = await this.findUser({ span }, payload, req);
                } catch (error) {
                    TraceContext.setError({ span }, error);
                    log.error("Cannot find user.", error, {});
                }
                if (!user) {
                    res.statusCode = 401;
                    res.send("Unauthorized: Cannot find authorized user.");
                    span.finish();
                    await this.webhookEvents.updateEvent(event.id, { status: "dismissed_unauthorized" });
                    return;
                }

                try {
                    await this.handlePushHook({ span }, payload, user, event);
                } catch (err) {
                    TraceContext.setError({ span }, err);
                    throw err;
                } finally {
                    span.finish();
                }
            } else {
                log.info("Unknown GitHub Enterprise event received", { event });
            }
            res.send("OK");
        });
    }

    private async findUser(
        ctx: TraceContext,
        payload: GitHubEnterprisePushPayload,
        req: express.Request,
    ): Promise<User | undefined> {
        const span = TraceContext.startSpan("GitHubEnterpriseApp.findUser", ctx);
        try {
            let host = req.header("X-Github-Enterprise-Host");
            if (!host) {
                // If the GitHub installation doesn't identify itself, we fall back to the hostname from the repository URL.
                const repoUrl = new URL(payload.repository.url);
                host = repoUrl.hostname;
            }
            const hostContext = this.hostContextProvider.get(host || "");
            if (!hostContext) {
                throw new Error("Unsupported GitHub Enterprise host: " + host);
            }
            const cloneURL = payload.repository.clone_url;
            const projectOwners = await this.findProjectOwners(cloneURL);
            if (!projectOwners) {
                throw new Error("No project found.");
            }
            for (const user of projectOwners.users) {
                const gitpodIdentity = user.identities.find(
                    (i) => i.authProviderId === TokenService.GITPOD_AUTH_PROVIDER_ID,
                );
                if (!gitpodIdentity) {
                    continue;
                }
                // Verify the webhook signature
                const signature = req.header("X-Hub-Signature-256");
                const body = (req as any).rawBody;
                const tokenEntries = (await this.userService.findTokensForIdentity(user.id, gitpodIdentity)).filter(
                    (tokenEntry) => {
                        return tokenEntry.token.scopes.includes(PREBUILD_TOKEN_SCOPE);
                    },
                );
                const signatureMatched = tokenEntries.some((tokenEntry) => {
                    const sig =
                        "sha256=" +
                        createHmac("sha256", user.id + "|" + tokenEntry.token.value)
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                            .update(body)
                            .digest("hex");
                    return timingSafeEqual(Buffer.from(sig), Buffer.from(signature ?? ""));
                });
                if (signatureMatched) {
                    if (!!user.blocked) {
                        throw new Error(`Blocked user ${user.id} tried to start prebuild.`);
                    }
                    return user;
                }
            }
        } finally {
            span.finish();
        }
    }

    private async handlePushHook(
        ctx: TraceContext,
        payload: GitHubEnterprisePushPayload,
        user: User,
        event: WebhookEvent,
    ): Promise<void> {
        const span = TraceContext.startSpan("GitHubEnterpriseApp.handlePushHook", ctx);
        try {
            const cloneURL = payload.repository.clone_url;
            const contextURL = this.createContextUrl(payload);
            const context = (await this.contextParser.handle({ span }, user, contextURL)) as CommitContext;
            const projects = await runWithSubjectId(SYSTEM_USER, () =>
                this.projectService.findProjectsByCloneUrl(SYSTEM_USER_ID, context.repository.cloneUrl),
            );
            span.setTag("contextURL", contextURL);
            for (const project of projects) {
                try {
                    const projectOwner = await this.findProjectOwner(project, user);

                    await this.webhookEvents.updateEvent(event.id, {
                        authorizedUserId: user.id,
                        projectId: project.id,
                        cloneUrl: cloneURL,
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
                        log.info("GitHub Enterprise push event: No prebuild.", { config, context });

                        await this.webhookEvents.updateEvent(event.id, {
                            prebuildStatus: "ignored_unconfigured",
                            status: "processed",
                            message: prebuildPrecondition.reason,
                        });
                        continue;
                    }

                    log.debug("GitHub Enterprise push event: Starting prebuild.", { contextURL });

                    await runWithSubjectId(SubjectId.fromUserId(projectOwner.id), async () => {
                        const commitInfo = await this.getCommitInfo(user, payload.repository.url, payload.after);
                        const ws = await this.prebuildManager.startPrebuild(
                            { span },
                            {
                                context,
                                user: projectOwner,
                                project: project,
                                commitInfo,
                            },
                        );
                        if (!ws.done) {
                            await this.webhookEvents.updateEvent(event.id, {
                                prebuildStatus: "prebuild_triggered",
                                status: "processed",
                                prebuildId: ws.prebuildId,
                            });
                        }
                    });
                } catch (error) {
                    log.error("Error processing GitHub webhook event", error);
                }
            }
        } catch (e) {
            log.error("Error processing GitHub Enterprise webhook event.", e);
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
        const hostCtx = this.hostContextProvider.get(parsedRepo.host);
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

    private async findProjectOwner(project: Project, webhookInstaller: User): Promise<User> {
        try {
            if (!project.teamId) {
                throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "Project has no teamId.");
            }
            const teamMembers = await this.teamDB.findMembersByTeam(project.teamId || "");
            if (teamMembers.some((t) => t.userId === webhookInstaller.id)) {
                return webhookInstaller;
            }
            const hostContext = this.hostContextProvider.get(new URL(project.cloneUrl).host);
            const authProviderId = hostContext?.authProvider.authProviderId;
            for (const teamMember of teamMembers) {
                const user = await runWithSubjectId(SubjectId.fromUserId(webhookInstaller.id), () =>
                    this.userService.findUserById(webhookInstaller.id, teamMember.userId),
                );
                if (user && user.identities.some((i) => i.authProviderId === authProviderId)) {
                    return user;
                }
            }
        } catch (err) {
            log.info({ userId: webhookInstaller.id }, "Failed to find project and owner", err);
        }
        return webhookInstaller;
    }

    private async findProjectOwners(cloneURL: string): Promise<{ users: User[]; project: Project } | undefined> {
        try {
            const projects = await runWithSubjectId(SYSTEM_USER, async () =>
                this.projectService.findProjectsByCloneUrl(SYSTEM_USER_ID, cloneURL),
            );
            const project = projects[0];
            if (project) {
                const users = [];
                const owners = (await this.teamDB.findMembersByTeam(project.teamId || "")).filter(
                    (m) => m.role === "owner",
                );
                const hostContext = this.hostContextProvider.get(new URL(cloneURL).host);
                const authProviderId = hostContext?.authProvider.authProviderId;
                for (const teamMember of owners) {
                    const user = await runWithSubjectId(SubjectId.fromUserId(teamMember.userId), () =>
                        this.userService.findUserById(teamMember.userId, teamMember.userId),
                    );
                    if (user && user.identities.some((i) => i.authProviderId === authProviderId)) {
                        users.push(user);
                    }
                }
                return { users, project };
            }
        } catch (err) {
            log.info("Failed to find project and owner", err);
        }
        return undefined;
    }

    private getBranchFromRef(ref: string): string | undefined {
        const headsPrefix = "refs/heads/";
        if (ref.startsWith(headsPrefix)) {
            return ref.substring(headsPrefix.length);
        }

        return undefined;
    }

    private createContextUrl(payload: GitHubEnterprisePushPayload) {
        return `${payload.repository.url}/tree/${this.getBranchFromRef(payload.ref)}`;
    }

    get router(): express.Router {
        return this._router;
    }
}

interface GitHubEnterprisePushPayload {
    ref: string;
    after: string;
    repository: {
        url: string;
        clone_url: string;
    };
    sender: {
        login: string;
        id: string;
    };
}
