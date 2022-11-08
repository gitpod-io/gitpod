/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as express from "express";
import { postConstruct, injectable, inject } from "inversify";
import { ProjectDB, TeamDB, UserDB, WebhookEventDB } from "@gitpod/gitpod-db/lib";
import { PrebuildManager } from "../prebuilds/prebuild-manager";
import { TokenService } from "../../../src/user/token-service";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { CommitContext, CommitInfo, Project, StartPrebuildResult, User, WebhookEvent } from "@gitpod/gitpod-protocol";
import { RepoURL } from "../../../src/repohost";
import { HostContextProvider } from "../../../src/auth/host-context-provider";
import { ContextParser } from "../../../src/workspace/context-parser-service";

@injectable()
export class BitbucketServerApp {
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(PrebuildManager) protected readonly prebuildManager: PrebuildManager;
    @inject(TokenService) protected readonly tokenService: TokenService;
    @inject(ProjectDB) protected readonly projectDB: ProjectDB;
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(ContextParser) protected readonly contextParser: ContextParser;
    @inject(HostContextProvider) protected readonly hostCtxProvider: HostContextProvider;
    @inject(WebhookEventDB) protected readonly webhookEvents: WebhookEventDB;

    protected _router = express.Router();
    public static path = "/apps/bitbucketserver/";

    @postConstruct()
    protected init() {
        this._router.post("/", async (req, res) => {
            try {
                const payload = req.body;
                if (PushEventPayload.is(req.body)) {
                    const event = await this.webhookEvents.createEvent({
                        type: "push",
                        status: "received",
                        rawEvent: JSON.stringify(req.body),
                    });
                    const span = TraceContext.startSpan("BitbucketApp.handleEvent", {});
                    let queryToken = req.query["token"] as string;
                    if (typeof queryToken === "string") {
                        queryToken = decodeURIComponent(queryToken);
                    }
                    const user = await this.findUser({ span }, queryToken);
                    if (!user) {
                        // If the webhook installer is no longer found in Gitpod's DB
                        // we should send a UNAUTHORIZED signal.
                        res.statusCode = 401;
                        res.send();
                        span.finish();
                        await this.webhookEvents.updateEvent(event.id, { status: "dismissed_unauthorized" });
                        return;
                    }
                    try {
                        await this.handlePushHook({ span }, user, payload, event);
                    } catch (err) {
                        TraceContext.setError({ span }, err);
                        throw err;
                    } finally {
                        span.finish();
                    }
                } else {
                    console.warn(`Ignoring unsupported BBS event.`, { headers: req.headers });
                }
            } catch (err) {
                console.error(`Couldn't handle request.`, err, { headers: req.headers });
            } finally {
                // we always respond with OK, when we received a valid event.
                res.sendStatus(200);
            }
        });
    }

    protected async findUser(ctx: TraceContext, secretToken: string): Promise<User> {
        const span = TraceContext.startSpan("BitbucketApp.findUser", ctx);
        try {
            span.setTag("secret-token", secretToken);
            const [userid, tokenValue] = secretToken.split("|");
            const user = await this.userDB.findUserById(userid);
            if (!user) {
                throw new Error("No user found for " + secretToken + " found.");
            } else if (!!user.blocked) {
                throw new Error(`Blocked user ${user.id} tried to start prebuild.`);
            }
            const identity = user.identities.find((i) => i.authProviderId === TokenService.GITPOD_AUTH_PROVIDER_ID);
            if (!identity) {
                throw new Error(`User ${user.id} has no identity for '${TokenService.GITPOD_AUTH_PROVIDER_ID}'.`);
            }
            const tokens = await this.userDB.findTokensForIdentity(identity);
            const token = tokens.find((t) => t.token.value === tokenValue);
            if (!token) {
                throw new Error(`User ${user.id} has no token with given value.`);
            }
            return user;
        } finally {
            span.finish();
        }
    }

    protected async handlePushHook(
        ctx: TraceContext,
        user: User,
        payload: PushEventPayload,
        event: WebhookEvent,
    ): Promise<StartPrebuildResult | undefined> {
        const span = TraceContext.startSpan("Bitbucket.handlePushHook", ctx);
        try {
            const contextUrl = this.createContextUrl(payload);
            span.setTag("contextUrl", contextUrl);
            const context = await this.contextParser.handle({ span }, user, contextUrl);
            if (!CommitContext.is(context)) {
                throw new Error("CommitContext exprected.");
            }
            const cloneUrl = context.repository.cloneUrl;
            const commit = context.revision;
            const projectAndOwner = await this.findProjectAndOwner(cloneUrl, user);
            if (projectAndOwner.project) {
                /* tslint:disable-next-line */
                /** no await */ this.projectDB.updateProjectUsage(projectAndOwner.project.id, {
                    lastWebhookReceived: new Date().toISOString(),
                });
            }
            await this.webhookEvents.updateEvent(event.id, {
                authorizedUserId: user.id,
                projectId: projectAndOwner?.project?.id,
                cloneUrl,
                branch: context.ref,
                commit: context.revision,
            });
            const config = await this.prebuildManager.fetchConfig({ span }, user, context);
            if (!this.prebuildManager.shouldPrebuild(config)) {
                console.log("Bitbucket push event: No config. No prebuild.");
                await this.webhookEvents.updateEvent(event.id, {
                    prebuildStatus: "ignored_unconfigured",
                    status: "processed",
                });
                return undefined;
            }

            console.debug("Bitbucket Server push event: Starting prebuild.", { contextUrl });

            const commitInfo = await this.getCommitInfo(user, cloneUrl, commit);

            const ws = await this.prebuildManager.startPrebuild(
                { span },
                {
                    user: projectAndOwner.user,
                    project: projectAndOwner?.project,
                    context,
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
            console.error("Error processing Bitbucket Server webhook event", e);
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
     * looks for a team member which also has a bitbucket.org connection.
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
                for (const teamMember of teamMembers) {
                    const user = await this.userDB.findUserById(teamMember.userId);
                    if (user && user.identities.some((i) => i.authProviderId === "Public-Bitbucket")) {
                        return { user, project };
                    }
                }
            }
        }
        return { user: webhookInstaller };
    }

    protected createContextUrl(event: PushEventPayload): string {
        const projectBrowseUrl = event.repository.links.self[0].href;
        const branchName = event.changes[0].ref.displayId;
        const contextUrl = `${projectBrowseUrl}?at=${encodeURIComponent(branchName)}`;
        return contextUrl;
    }

    get router(): express.Router {
        return this._router;
    }
}

interface PushEventPayload {
    eventKey: "repo:refs_changed" | string;
    date: string;
    actor: {
        name: string;
        emailAddress: string;
        id: number;
        displayName: string;
        slug: string;
        type: "NORMAL" | string;
    };
    repository: {
        slug: string;
        id: number;
        name: string;
        project: {
            key: string;
            id: number;
            name: string;
            public: boolean;
            type: "NORMAL" | "PERSONAL";
        };
        links: {
            clone: {
                href: string;
                name: string;
            }[];
            self: {
                href: string;
            }[];
        };
        public: boolean;
    };
    changes: {
        ref: {
            id: string;
            displayId: string;
            type: "BRANCH" | string;
        };
        refId: string;
        fromHash: string;
        toHash: string;
        type: "UPDATE" | string;
    }[];
}
namespace PushEventPayload {
    export function is(payload: any): payload is PushEventPayload {
        return typeof payload === "object" && "eventKey" in payload && payload["eventKey"] === "repo:refs_changed";
    }
}
