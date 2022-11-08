/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as express from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { Buffer } from "buffer";
import { postConstruct, injectable, inject } from "inversify";
import { ProjectDB, TeamDB, UserDB, WebhookEventDB } from "@gitpod/gitpod-db/lib";
import { PrebuildManager } from "../prebuilds/prebuild-manager";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { TokenService } from "../../../src/user/token-service";
import { HostContextProvider } from "../../../src/auth/host-context-provider";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { CommitContext, CommitInfo, Project, StartPrebuildResult, User, WebhookEvent } from "@gitpod/gitpod-protocol";
import { GitHubService } from "./github-service";
import { URL } from "url";
import { ContextParser } from "../../../src/workspace/context-parser-service";
import { RepoURL } from "../../../src/repohost";

@injectable()
export class GitHubEnterpriseApp {
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(PrebuildManager) protected readonly prebuildManager: PrebuildManager;
    @inject(TokenService) protected readonly tokenService: TokenService;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(ProjectDB) protected readonly projectDB: ProjectDB;
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(ContextParser) protected readonly contextParser: ContextParser;
    @inject(WebhookEventDB) protected readonly webhookEvents: WebhookEventDB;

    protected _router = express.Router();
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

    protected async findUser(
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
                const tokenEntries = (await this.userDB.findTokensForIdentity(gitpodIdentity)).filter((tokenEntry) => {
                    return tokenEntry.token.scopes.includes(GitHubService.PREBUILD_TOKEN_SCOPE);
                });
                const signatureMatched = tokenEntries.some((tokenEntry) => {
                    const sig =
                        "sha256=" +
                        createHmac("sha256", user.id + "|" + tokenEntry.token.value)
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

    protected async handlePushHook(
        ctx: TraceContext,
        payload: GitHubEnterprisePushPayload,
        user: User,
        event: WebhookEvent,
    ): Promise<StartPrebuildResult | undefined> {
        const span = TraceContext.startSpan("GitHubEnterpriseApp.handlePushHook", ctx);
        try {
            const cloneURL = payload.repository.clone_url;
            const projectAndOwner = await this.findProjectAndOwner(cloneURL, user);
            if (projectAndOwner.project) {
                /* tslint:disable-next-line */
                /** no await */ this.projectDB.updateProjectUsage(projectAndOwner.project.id, {
                    lastWebhookReceived: new Date().toISOString(),
                });
            }
            const contextURL = this.createContextUrl(payload);
            span.setTag("contextURL", contextURL);
            const context = (await this.contextParser.handle({ span }, user, contextURL)) as CommitContext;

            await this.webhookEvents.updateEvent(event.id, {
                authorizedUserId: user.id,
                projectId: projectAndOwner?.project?.id,
                cloneUrl: cloneURL,
                branch: context.ref,
                commit: context.revision,
            });

            const config = await this.prebuildManager.fetchConfig({ span }, user, context);
            if (!this.prebuildManager.shouldPrebuild(config)) {
                log.info("GitHub Enterprise push event: No config. No prebuild.");

                await this.webhookEvents.updateEvent(event.id, {
                    prebuildStatus: "ignored_unconfigured",
                    status: "processed",
                });
                return undefined;
            }

            log.debug("GitHub Enterprise push event: Starting prebuild.", { contextURL });

            const commitInfo = await this.getCommitInfo(user, payload.repository.url, payload.after);
            const ws = await this.prebuildManager.startPrebuild(
                { span },
                {
                    context,
                    user: projectAndOwner.user,
                    project: projectAndOwner.project,
                    commitInfo,
                },
            );
            if (!ws.done) {
                await this.webhookEvents.updateEvent(event.id, {
                    prebuildStatus: "prebuild_triggered",
                    status: "processed",
                    prebuildId: ws.prebuildId,
                });
                return ws;
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

    /**
     * Finds the relevant user account and project to the provided webhook event information.
     *
     * First of all it tries to find the project for the given `cloneURL`, then it tries to
     * find the installer, which is also supposed to be a team member. As a fallback, it
     * looks for a team member which also has a connection with this GitHub Enterprise server.
     *
     * @param cloneURL of the webhook event
     * @param webhookInstaller the user account known from the webhook installation
     * @returns a promise which resolves to a user account and an optional project.
     */
    protected async findProjectAndOwner(
        cloneURL: string,
        webhookInstaller: User,
    ): Promise<{ user: User; project?: Project }> {
        const project = await this.projectDB.findProjectByCloneUrl(cloneURL);
        if (project) {
            if (project.userId) {
                const user = await this.userDB.findUserById(project.userId);
                if (user) {
                    return { user, project };
                }
            } else if (project.teamId) {
                const teamMembers = await this.teamDB.findMembersByTeam(project.teamId || "");
                if (teamMembers.some((t) => t.userId === webhookInstaller.id)) {
                    return { user: webhookInstaller, project };
                }
                const hostContext = this.hostContextProvider.get(new URL(cloneURL).host);
                const authProviderId = hostContext?.authProvider.authProviderId;
                for (const teamMember of teamMembers) {
                    const user = await this.userDB.findUserById(teamMember.userId);
                    if (user && user.identities.some((i) => i.authProviderId === authProviderId)) {
                        return { user, project };
                    }
                }
            }
        }
        return { user: webhookInstaller };
    }

    protected async findProjectOwners(cloneURL: string): Promise<{ users: User[]; project: Project } | undefined> {
        const project = await this.projectDB.findProjectByCloneUrl(cloneURL);
        if (project) {
            if (project.userId) {
                const user = await this.userDB.findUserById(project.userId);
                if (user) {
                    return { users: [user], project };
                }
            } else if (project.teamId) {
                const users = [];
                const owners = (await this.teamDB.findMembersByTeam(project.teamId || "")).filter(
                    (m) => m.role === "owner",
                );
                const hostContext = this.hostContextProvider.get(new URL(cloneURL).host);
                const authProviderId = hostContext?.authProvider.authProviderId;
                for (const teamMember of owners) {
                    const user = await this.userDB.findUserById(teamMember.userId);
                    if (user && user.identities.some((i) => i.authProviderId === authProviderId)) {
                        users.push(user);
                    }
                }
                return { users, project };
            }
        }
        return undefined;
    }

    protected getBranchFromRef(ref: string): string | undefined {
        const headsPrefix = "refs/heads/";
        if (ref.startsWith(headsPrefix)) {
            return ref.substring(headsPrefix.length);
        }

        return undefined;
    }

    protected createContextUrl(payload: GitHubEnterprisePushPayload) {
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
