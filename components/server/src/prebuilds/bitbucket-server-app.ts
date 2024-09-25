/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import express from "express";
import { postConstruct, injectable, inject } from "inversify";
import { TeamDB, WebhookEventDB } from "@gitpod/gitpod-db/lib";
import { PrebuildManager } from "./prebuild-manager";
import { TokenService } from "../user/token-service";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { CommitContext, CommitInfo, Project, User, WebhookEvent } from "@gitpod/gitpod-protocol";
import { RepoURL } from "../repohost";
import { HostContextProvider } from "../auth/host-context-provider";
import { ContextParser } from "../workspace/context-parser-service";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { UserService } from "../user/user-service";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { URL } from "url";
import { ProjectsService } from "../projects/projects-service";
import { SubjectId } from "../auth/subject-id";
import { runWithSubjectId } from "../util/request-context";
import { SYSTEM_USER, SYSTEM_USER_ID } from "../authorization/authorizer";

@injectable()
export class BitbucketServerApp {
    constructor(
        @inject(UserService) private readonly userService: UserService,
        @inject(PrebuildManager) private readonly prebuildManager: PrebuildManager,
        @inject(TeamDB) private readonly teamDB: TeamDB,
        @inject(ContextParser) private readonly contextParser: ContextParser,
        @inject(HostContextProvider) private readonly hostCtxProvider: HostContextProvider,
        @inject(WebhookEventDB) private readonly webhookEvents: WebhookEventDB,
        @inject(ProjectsService) private readonly projectService: ProjectsService,
    ) {}

    private _router = express.Router();
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
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                        await this.handlePushHook({ span }, user, payload, event);
                    } catch (err) {
                        TraceContext.setError({ span }, err);
                        throw err;
                    } finally {
                        span.finish();
                    }
                } else {
                    log.warn(`Ignoring unsupported BBS event.`, { headers: req.headers });
                }
            } catch (err) {
                log.error(`Couldn't handle request.`, err, { headers: req.headers });
            } finally {
                // we always respond with OK, when we received a valid event.
                res.sendStatus(200);
            }
        });
    }

    private async findUser(ctx: TraceContext, secretToken: string): Promise<User> {
        const span = TraceContext.startSpan("BitbucketApp.findUser", ctx);
        try {
            span.setTag("secret-token", secretToken);
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
            return user;
        } finally {
            span.finish();
        }
    }

    private async handlePushHook(
        ctx: TraceContext,
        user: User,
        payload: PushEventPayload,
        event: WebhookEvent,
    ): Promise<void> {
        const span = TraceContext.startSpan("Bitbucket.handlePushHook", ctx);
        try {
            const cloneURL = this.getCloneUrl(payload);
            const projects = await runWithSubjectId(SYSTEM_USER, () =>
                this.projectService.findProjectsByCloneUrl(SYSTEM_USER_ID, cloneURL),
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

                    const contextUrl = this.createBranchContextUrl(payload);
                    span.setTag("contextUrl", contextUrl);
                    const context = await this.contextParser.handle({ span }, user, contextUrl);
                    if (!CommitContext.is(context)) {
                        log.error("CommitContext expected.", { contextUrl });
                        continue;
                    }
                    const commit = context.revision;
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
                        log.info("Bitbucket Server push event: No prebuild.", { config, context });
                        await this.webhookEvents.updateEvent(event.id, {
                            prebuildStatus: "ignored_unconfigured",
                            status: "processed",
                            message: prebuildPrecondition.reason,
                        });
                        continue;
                    }

                    log.debug("Bitbucket Server push event: Starting prebuild.", { contextUrl });

                    await runWithSubjectId(SubjectId.fromUserId(projectOwner.id), async () => {
                        const commitInfo = await this.getCommitInfo(user, cloneURL, commit);
                        const ws = await this.prebuildManager.startPrebuild(
                            { span },
                            {
                                user: projectOwner,
                                project: project,
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
                        }
                    });
                } catch (error) {
                    log.error("Error processing Bitbucket Server webhook event", error);
                }
            }
        } catch (e) {
            log.error("Error processing Bitbucket Server webhook event", e);
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

    private async findProjectOwner(project: Project, webhookInstaller: User): Promise<User> {
        try {
            if (!project.teamId) {
                throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "Project has no teamId.");
            }
            const teamMembers = await this.teamDB.findMembersByTeam(project.teamId);
            if (teamMembers.some((t) => t.userId === webhookInstaller.id)) {
                return webhookInstaller;
            }
            const hostContext = this.hostCtxProvider.get(new URL(project.cloneUrl).host);
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

    private createBranchContextUrl(event: PushEventPayload): string {
        const projectBrowseUrl = event.repository.links.self[0].href;
        const branchName = event.changes[0].ref.displayId;
        const contextUrl = `${projectBrowseUrl}?at=${encodeURIComponent(branchName)}`;
        return contextUrl;
    }

    private getCloneUrl(event: PushEventPayload): string {
        // "links": {
        //     "clone": [
        //         {
        //             "href": "ssh://git@bitbucket.gitpod-dev.com:7999/tes/hello-world-zz-1.git",
        //             "name": "ssh"
        //         },
        //         {
        //             "href": "https://bitbucket.gitpod-dev.com/scm/tes/hello-world-zz-1.git",
        //             "name": "http"
        //         }
        //     ],
        //     "self": [...]
        // }
        const cloneURL = event.repository?.links?.clone?.find((link) => link?.name === "http")?.href;
        if (!cloneURL) {
            throw new Error(`Expected to read clone URL from push event. Repository: ${event?.repository?.name}`);
        }
        return cloneURL;
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
