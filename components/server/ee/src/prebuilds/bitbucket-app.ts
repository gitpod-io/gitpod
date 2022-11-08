/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as express from "express";
import { postConstruct, injectable, inject } from "inversify";
import { ProjectDB, TeamDB, UserDB, WebhookEventDB } from "@gitpod/gitpod-db/lib";
import { User, StartPrebuildResult, CommitContext, CommitInfo, Project, WebhookEvent } from "@gitpod/gitpod-protocol";
import { PrebuildManager } from "../prebuilds/prebuild-manager";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { TokenService } from "../../../src/user/token-service";
import { ContextParser } from "../../../src/workspace/context-parser-service";
import { HostContextProvider } from "../../../src/auth/host-context-provider";
import { RepoURL } from "../../../src/repohost";

@injectable()
export class BitbucketApp {
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(PrebuildManager) protected readonly prebuildManager: PrebuildManager;
    @inject(TokenService) protected readonly tokenService: TokenService;
    @inject(ProjectDB) protected readonly projectDB: ProjectDB;
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(ContextParser) protected readonly contextParser: ContextParser;
    @inject(HostContextProvider) protected readonly hostCtxProvider: HostContextProvider;
    @inject(WebhookEventDB) protected readonly webhookEvents: WebhookEventDB;

    protected _router = express.Router();
    public static path = "/apps/bitbucket/";

    @postConstruct()
    protected init() {
        this._router.post("/", async (req, res) => {
            try {
                if (req.header("X-Event-Key") === "repo:push") {
                    const span = TraceContext.startSpan("BitbucketApp.handleEvent", {});
                    const secretToken = req.query["token"] as string;
                    const event = await this.webhookEvents.createEvent({
                        type: "push",
                        status: "received",
                        rawEvent: JSON.stringify(req.body),
                    });
                    if (!secretToken) {
                        await this.webhookEvents.updateEvent(event.id, { status: "dismissed_unauthorized" });
                        throw new Error("No secretToken provided.");
                    }
                    const user = await this.findUser({ span }, secretToken);
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
                        const data = toData(req.body);
                        if (data) {
                            await this.handlePushHook({ span }, data, user, event);
                        }
                    } catch (err) {
                        TraceContext.setError({ span }, err);
                        throw err;
                    } finally {
                        span.finish();
                    }
                } else {
                    console.warn(`Ignoring unsupported bitbucket event: ${req.header("X-Event-Key")}`);
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
        data: ParsedRequestData,
        user: User,
        event: WebhookEvent,
    ): Promise<StartPrebuildResult | undefined> {
        const span = TraceContext.startSpan("Bitbucket.handlePushHook", ctx);
        try {
            const projectAndOwner = await this.findProjectAndOwner(data.gitCloneUrl, user);
            if (projectAndOwner.project) {
                /* tslint:disable-next-line */
                /** no await */ this.projectDB.updateProjectUsage(projectAndOwner.project.id, {
                    lastWebhookReceived: new Date().toISOString(),
                });
            }

            const contextURL = this.createContextUrl(data);
            span.setTag("contextURL", contextURL);
            const context = (await this.contextParser.handle({ span }, user, contextURL)) as CommitContext;
            await this.webhookEvents.updateEvent(event.id, {
                authorizedUserId: user.id,
                projectId: projectAndOwner?.project?.id,
                cloneUrl: context.repository.cloneUrl,
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

            console.log("Starting prebuild.", { contextURL });
            const { host, owner, repo } = RepoURL.parseRepoUrl(data.repoUrl)!;
            const hostCtx = this.hostCtxProvider.get(host);
            let commitInfo: CommitInfo | undefined;
            if (hostCtx?.services?.repositoryProvider) {
                commitInfo = await hostCtx.services.repositoryProvider.getCommitInfo(
                    user,
                    owner,
                    repo,
                    data.commitHash,
                );
            }
            const ws = await this.prebuildManager.startPrebuild(
                { span },
                { user, project: projectAndOwner.project, context, commitInfo },
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
            console.error("Error processing Bitbucket webhook event", e);
            await this.webhookEvents.updateEvent(event.id, {
                prebuildStatus: "prebuild_trigger_failed",
                status: "processed",
            });
            throw e;
        } finally {
            span.finish();
        }
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

    protected createContextUrl(data: ParsedRequestData) {
        const contextUrl = `${data.repoUrl}/src/${data.commitHash}/?at=${encodeURIComponent(data.branchName)}`;
        return contextUrl;
    }

    get router(): express.Router {
        return this._router;
    }
}

function toData(body: BitbucketPushHook): ParsedRequestData | undefined {
    const branchName = body.push.changes[0]?.new?.name;
    const commitHash = body.push.changes[0]?.new?.target?.hash;
    if (!branchName || !commitHash) {
        return undefined;
    }
    const result = {
        branchName,
        commitHash,
        repoUrl: body.repository.links.html.href,
        gitCloneUrl: body.repository.links.html.href + ".git",
    };
    if (!result.commitHash || !result.repoUrl) {
        console.error("Bitbucket push event: unexpected request body.");
        throw new Error("Unexpected request body.");
    }
    return result;
}

interface ParsedRequestData {
    branchName: string;
    repoUrl: string;
    gitCloneUrl: string;
    commitHash: string;
}

interface BitbucketPushHook {
    push: {
        changes: {
            new: {
                name: string; // e.g. "foo/bar-bazz"
                type: "branch" | string;
                target: {
                    hash: string; // e.g. "1b283e4d7a849a89151548398cc836d15149179c"
                };
            } | null; // in case where a branch is deleted
        }[];
    };
    actor: {
        account_id: string; // e.g. "557058:964d5de0-9ae8-47e7-9ca2-9448caeb50ea"
    };
    repository: BitbucketRepository;
}

interface BitbucketRepository {
    links: {
        html: {
            href: string; //e.g. "https://bitbucket.org/sefftinge/sample-repository"
        };
    };
    full_name: string; // e.g. "sefftinge/sample-repository",
    is_private: boolean;
}
