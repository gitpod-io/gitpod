/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import express from "express";
import { postConstruct, injectable, inject } from "inversify";
import { TeamDB, WebhookEventDB } from "@gitpod/gitpod-db/lib";
import { User, CommitContext, CommitInfo, Project, WebhookEvent } from "@gitpod/gitpod-protocol";
import { PrebuildManager } from "./prebuild-manager";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { TokenService } from "../user/token-service";
import { ContextParser } from "../workspace/context-parser-service";
import { HostContextProvider } from "../auth/host-context-provider";
import { RepoURL } from "../repohost";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { UserService } from "../user/user-service";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { URL } from "url";
import { ProjectsService } from "../projects/projects-service";
import { SubjectId } from "../auth/subject-id";
import { runWithSubjectId } from "../util/request-context";
import { SYSTEM_USER, SYSTEM_USER_ID } from "../authorization/authorizer";

@injectable()
export class BitbucketApp {
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
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
        data: ParsedRequestData,
        user: User,
        event: WebhookEvent,
    ): Promise<void> {
        const span = TraceContext.startSpan("Bitbucket.handlePushHook", ctx);
        try {
            const cloneURL = data.gitCloneUrl;
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

                    const contextURL = this.createContextUrl(data);
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
                        log.info("Bitbucket push event: No prebuild.", { config, context });
                        await this.webhookEvents.updateEvent(event.id, {
                            prebuildStatus: "ignored_unconfigured",
                            status: "processed",
                            message: prebuildPrecondition.reason,
                        });
                        continue;
                    }

                    await runWithSubjectId(SubjectId.fromUserId(projectOwner.id), async () => {
                        log.info("Starting prebuild.", { contextURL });
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
                            {
                                user: projectOwner,
                                project,
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
                    log.error("Error processing Bitbucket webhook event", error);
                }
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
    private async findProjectOwner(project: Project, webhookInstaller: User): Promise<User> {
        try {
            if (!project.teamId) {
                throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "Project has no teamId");
            }
            const teamMembers = await this.teamDB.findMembersByTeam(project.teamId);
            if (teamMembers.some((t) => t.userId === webhookInstaller.id)) {
                return webhookInstaller;
            }
            const hostContext = this.hostCtxProvider.get(new URL(project.cloneUrl).host);
            const authProviderId = hostContext?.authProvider.authProviderId;
            for (const teamMember of teamMembers) {
                const user = await runWithSubjectId(SubjectId.fromUserId(teamMember.userId), () =>
                    this.userService.findUserById(teamMember.userId, teamMember.userId),
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

    private createContextUrl(data: ParsedRequestData) {
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
