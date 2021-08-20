/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Server, Probot, Context } from 'probot';
import { getPrivateKey } from '@probot/get-private-key';
import {WebhookEvent, EventPayloads} from "@octokit/webhooks/dist-types"
import * as fs from 'fs-extra';
import { injectable, inject } from 'inversify';
import { Env } from '../../../src/env';
import { AppInstallationDB, TracedWorkspaceDB, DBWithTracing, UserDB, WorkspaceDB, ProjectDB, TeamDB } from '@gitpod/gitpod-db/lib';
import * as express from 'express';
import { log, LogContext } from '@gitpod/gitpod-protocol/lib/util/logging';
import { WorkspaceConfig, User, Project } from '@gitpod/gitpod-protocol';
import { MessageBusIntegration } from '../../../src/workspace/messagebus-integration';
import { GithubAppRules } from './github-app-rules';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { PrebuildManager, StartPrebuildResult } from './prebuild-manager';
import { PrebuildStatusMaintainer } from './prebuilt-status-maintainer';
import { Options, ApplicationFunctionOptions } from 'probot/lib/types';

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
    @inject(ProjectDB) protected readonly projectDB: ProjectDB;
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(AppInstallationDB) protected readonly appInstallationDB: AppInstallationDB;
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;
    @inject(MessageBusIntegration) protected readonly messageBus: MessageBusIntegration;
    @inject(GithubAppRules) protected readonly appRules: GithubAppRules;
    @inject(PrebuildManager) protected readonly prebuildManager: PrebuildManager;

    readonly server: Server | undefined;

    constructor(
        @inject(Env) protected readonly env: Env,
        @inject(PrebuildStatusMaintainer) protected readonly statusMaintainer: PrebuildStatusMaintainer,
    ) {
        if (env.githubAppEnabled) {
            this.server = new Server({
                Probot: Probot.defaults({
                    appId: env.githubAppAppID,
                    privateKey: GithubApp.loadPrivateKey(env.githubAppCertPath),
                    secret: env.githubAppWebhookSecret,
                    logLevel: env.githubAppLogLevel as Options["logLevel"],
                    baseUrl: env.githubAppGHEHost,
                })
            });
            log.debug("Starting GitHub app integration", {
                appId: env.githubAppAppID,
                cert: env.githubAppCertPath,
                secret: env.githubAppWebhookSecret
            });
            this.server.load(this.buildApp.bind(this));
        }
    }

    protected async buildApp(app: Probot, options: ApplicationFunctionOptions) {
        this.statusMaintainer.start(async (id) => {
            try {
                const githubApi = await app.auth(parseInt(id));
                return githubApi;
            } catch (error) {
                log.error("Failes to authorize GH API for Probot", { error })
            }
        });

        // Backward-compatibility: Redirect old badge URLs (e.g. "/api/apps/github/pbs/github.com/gitpod-io/gitpod/5431d5735c32ab7d5d840a4d1a7d7c688d1f0ce9.svg")
        options.getRouter && options.getRouter('/pbs').get('/*', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            res.redirect(301, this.getBadgeImageURL());
        });

        app.on('installation.created', async ctx => {
            const targetAccountName = `${ctx.payload.installation.account.login}`;
            const installationId = `${ctx.payload.installation.id}`;

            // cf. https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#installation
            const authId = `${ctx.payload.sender.id}`;

            const user = await this.userDB.findUserByIdentity({ authProviderId: this.env.githubAppAuthProviderId, authId });
            const userId = user ? user.id : undefined;
            await this.appInstallationDB.recordNewInstallation("github", 'platform', installationId, userId, authId);
            log.debug({ userId }, "New installation recorded", { userId, authId, targetAccountName })
        });
        app.on('installation.deleted', async ctx => {
            const installationId = `${ctx.payload.installation.id}`;
            await this.appInstallationDB.recordUninstallation("github", 'platform', installationId);
        });

        app.on('repository.renamed', async ctx => {
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
                    const project = await this.projectDB.findProjectByCloneUrl(`https://github.com/${repository.owner.login}/${oldName}.git`)
                    if (project) {
                        project.cloneUrl = repository.clone_url;
                        await this.projectDB.storeProject(project);
                    }
                }
            }
            // TODO(at): handle deleted as well
        });

        app.on('push', async ctx => {
            await this.handlePushEvent(ctx);
        });

        app.on(['pull_request.opened', 'pull_request.synchronize', 'pull_request.reopened'], async ctx => {
            await this.handlePullRequest(ctx);
        });

        options.getRouter && options.getRouter('/reconfigure').get('/', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            const gh = await app.auth();
            const data = await gh.apps.getAuthenticated();
            const slug = data.data.slug;

            const state = req.query.state;
            res.redirect(`https://github.com/apps/${slug}/installations/new?state=${state}`)
        });
        options.getRouter && options.getRouter('/setup').get('/', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            const state = req.query.state;
            const installationId = req.query.installation_id;
            const setupAction = req.query.setup_action;
            const payload = { installationId, setupAction };
            req.query

            if (state) {
                const url = this.env.hostUrl.with({ pathname: '/complete-auth', search: "message=payload:" + Buffer.from(JSON.stringify(payload), "utf-8").toString('base64') }).toString();
                res.redirect(url);
            } else {
                const url = this.env.hostUrl.with({ pathname: 'install-github-app', search: `installation_id=${installationId}` }).toString();
                res.redirect(url);
            }

        });
    }

    protected async handlePushEvent(ctx: WebhookEvent<EventPayloads.WebhookPayloadPush> & Omit<Context, keyof WebhookEvent>): Promise<void> {
        const span = TraceContext.startSpan("GithubApp.handlePushEvent", {});
        span.setTag("request", ctx.id);

        try {
            const installationId = ctx.payload.installation?.id;
            const cloneURL = ctx.payload.repository.clone_url;
            const owner = installationId && (await this.findProjectOwner(cloneURL) || (await this.findInstallationOwner(installationId)));
            if (!owner) {
                log.info(`No installation or associated user found.`, { repo: ctx.payload.repository, installationId });
                return;
            }
            const logCtx: LogContext = { userId: owner.user.id };

            if (!!owner.user.blocked) {
                log.info(logCtx, `Blocked user tried to start prebuild`, { repo: ctx.payload.repository });
                return;
            }

            const pl = ctx.payload;
            const branch = this.getBranchFromRef(pl.ref);
            if (!branch) {
                // This is a valid case if we receive a tag push, for instance.
                log.debug("Unable to get branch from ref", { ref: pl.ref });
                return;
            }

            const repo = pl.repository;
            const contextURL = `${repo.html_url}/tree/${branch}`;
            span.setTag('contextURL', contextURL);

            let config = await this.prebuildManager.fetchConfig({ span }, owner.user, contextURL);
            const runPrebuild = this.appRules.shouldRunPrebuild(config, branch == repo.default_branch, false, false);
            if (!runPrebuild) {
                const reason = `Not running prebuild, the user did not enable it for this context`;
                log.debug(logCtx, reason, { contextURL });
                span.log({ "not-running": reason, "config": config });
                return;
            }
            const { user, project } = owner;
            this.prebuildManager.startPrebuild({ span }, { user, contextURL, cloneURL: repo.clone_url, commit: pl.after, branch, project})
                .catch(err => log.error(logCtx, "Error while starting prebuild", err, { contextURL }));
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected getBranchFromRef(ref: string): string | undefined {
        const headsPrefix = "refs/heads/";
        if (ref.startsWith(headsPrefix)) {
            return ref.substring(headsPrefix.length);
        }

        return undefined;
    }

    protected async handlePullRequest(ctx: WebhookEvent<EventPayloads.WebhookPayloadPullRequest> & Omit<Context<any>, keyof WebhookEvent<any>>): Promise<void> {
        const span = TraceContext.startSpan("GithubApp.handlePullRequest", {});
        span.setTag("request", ctx.id);

        try {
            const installationId = ctx.payload.installation?.id;
            const cloneURL = ctx.payload.repository.clone_url;
            const owner = installationId && (await this.findProjectOwner(cloneURL) || (await this.findInstallationOwner(installationId)));
            if (!owner) {
                log.warn("Did not find user for installation. Someone's Gitpod experience may be broken.", { repo: ctx.payload.repository, installationId });
                return;
            }

            const pr = ctx.payload.pull_request;
            const contextURL = pr.html_url;
            const config = await this.prebuildManager.fetchConfig({ span }, owner.user, contextURL);

            const prebuildStartPromise = this.onPrStartPrebuild({ span }, config, owner, ctx);
            this.onPrAddCheck({ span }, config, ctx, prebuildStartPromise);
            this.onPrAddBadge(config, ctx);
            this.onPrAddComment(config, ctx);
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async onPrAddCheck(tracecContext: TraceContext, config: WorkspaceConfig | undefined, ctx: Context, start: Promise<StartPrebuildResult> | undefined) {
        if (!start) {
            return;
        }

        if (!this.appRules.shouldDo(config, 'addCheck')) {
            return;
        }

        const span = TraceContext.startSpan("onPrAddCheck", tracecContext);
        try {
            const spr = await start;
            const pws = await this.workspaceDB.trace({ span }).findPrebuildByWorkspaceID(spr.wsid);
            if (!pws) {
                return;
            }

            await this.statusMaintainer.registerCheckRun({ span }, ctx.payload.installation.id, pws, {
                ...ctx.repo(),
                head_sha: ctx.payload.pull_request.head.sha,
                details_url: this.env.hostUrl.withContext(ctx.payload.pull_request.html_url).toString()
            });
        } catch (err) {
            TraceContext.logError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    protected onPrStartPrebuild(tracecContext: TraceContext, config: WorkspaceConfig | undefined, owner: {user: User, project?: Project}, ctx: WebhookEvent<EventPayloads.WebhookPayloadPullRequest>): Promise<StartPrebuildResult> | undefined {
        const { user, project } = owner;
        const pr = ctx.payload.pull_request;
        const pr_head = pr.head;
        const contextURL = pr.html_url;
        const branch = pr.head.ref;
        const cloneURL = pr_head.repo.clone_url;

        const isFork = pr.head.repo.id !== pr.base.repo.id;
        const runPrebuild = this.appRules.shouldRunPrebuild(config, false, true, isFork);
        let prebuildStartPromise: Promise<StartPrebuildResult> | undefined;
        if (runPrebuild) {
            prebuildStartPromise = this.prebuildManager.startPrebuild(tracecContext, {user, contextURL, cloneURL, commit: pr_head.sha, branch, project});
            prebuildStartPromise.catch(err => log.error(err, "Error while starting prebuild", { contextURL }));
            return prebuildStartPromise;
        } else {
            log.debug({ userId: owner.user.id }, `Not running prebuild, the user did not enable it for this context`, { contextURL, owner });
            return;
        }
    }

    protected onPrAddBadge(config: WorkspaceConfig | undefined, ctx: Context) {
        if (!this.appRules.shouldDo(config, 'addBadge')) {
            // we shouldn't add (or update) a button here
            return;
        }

        const pr = ctx.payload.pull_request;
        const contextURL = pr.html_url;
        const body: string = pr.body;
        const button = `<a href="${this.env.hostUrl.withContext(contextURL)}"><img src="${this.getBadgeImageURL()}"/></a>`;
        if (body.includes(button)) {
            // the button is already in the comment
            return;
        }

        const newBody = body + `\n\n${button}\n\n`;
        const updatePrPromise = ctx.octokit.pulls.update({ ...ctx.repo(), pull_number: pr.number, body: newBody });
        updatePrPromise.catch(err => log.error(err, "Error while updating PR body", { contextURL }));
    }

    protected async onPrAddComment(config: WorkspaceConfig | undefined, ctx: Context) {
        if (!this.appRules.shouldDo(config, 'addComment')) {
            return;
        }

        const pr = ctx.payload.pull_request;
        const contextURL = pr.html_url;
        const button = `<a href="${this.env.hostUrl.withContext(contextURL)}"><img src="${this.getBadgeImageURL()}"/></a>`;
        const comments = await ctx.octokit.issues.listComments(ctx.issue());
        const existingComment = comments.data.find((c: any) => c.body.indexOf(button) > -1);
        if (existingComment) {
            return;
        }

        const newComment = ctx.issue({ body: `\n\n${button}\n\n` });
        const newCommentPromise = ctx.octokit.issues.createComment(newComment);
        newCommentPromise.catch(err => log.error(err, "Error while adding new PR comment", { contextURL }));
    }

    protected getBadgeImageURL(): string {
        return this.env.hostUrl.with({ pathname: '/button/open-in-gitpod.svg' }).toString();
    }

    protected async findProjectOwner(cloneURL: string): Promise<{user: User, project?: Project} | undefined> {
        // Project mode
        //
        const project = await this.projectDB.findProjectByCloneUrl(cloneURL);
        if (project) {
            const owner = !!project.userId
                ? { userId: project.userId }
                : (await this.teamDB.findMembersByTeam(project.teamId || '')).filter(m => m.role === "owner")[0];
            if (owner) {
                const user = await this.userDB.findUserById(owner.userId);
                if (user) {
                    return { user, project}
                }
            }
        }
    }

    protected async findInstallationOwner(installationId: number): Promise<{user: User, project?: Project} | undefined> {
        // Legacy mode
        //
        const installation = await this.appInstallationDB.findInstallation("github", String(installationId));
        if (!installation) {
            log.error("Prebuilt requested from unknown GitHub app installation");
            return;
        }

        const ownerID = installation.ownerUserID || "this-should-never-happen";
        const user = await this.userDB.findUserById(ownerID);
        if (!user) {
            log.error(`App installation owner ${ownerID} does not exist`)
            return;
        }

        return { user };
    }
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
}
