/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Server, Probot, Context } from 'probot';
import { getPrivateKey } from '@probot/get-private-key';
import * as fs from 'fs-extra';
import { injectable, inject, decorate } from 'inversify';
import { Env } from '../../../src/env';
import { AppInstallationDB, TracedWorkspaceDB, DBWithTracing, UserDB, WorkspaceDB } from '@gitpod/gitpod-db/lib';
import * as express from 'express';
import { log, LogContext } from '@gitpod/gitpod-protocol/lib/util/logging';
import { WorkspaceConfig, User, GithubAppPrebuildConfig, Disposable } from '@gitpod/gitpod-protocol';
import { MessageBusIntegration } from '../../../src/workspace/messagebus-integration';
import { HeadlessWorkspaceEventType, HeadlessLogEvent } from '@gitpod/gitpod-protocol/lib/headless-workspace-log';
import { GithubAppRules } from './github-app-rules';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { PrebuildManager } from './prebuild-manager';
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

decorate(injectable(), Probot)

@injectable()
export class GithubApp {
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
                    logLevel: env.githubAppLogLevel as Options["logLevel"]
                })
            })
            log.debug("Starting GitHub app integration", {
                appId: env.githubAppAppID,
                cert: env.githubAppCertPath,
                secret: env.githubAppWebhookSecret
            })
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
            const accountId: string = `${ctx.payload.installation.account.id}`;
            const installationId = `${ctx.payload.installation.id}`;
            const senderId = `${ctx.payload.sender.id}`;
            const user = await this.userDB.findUserByIdentity({ authProviderId: this.env.githubAppAuthProviderId, authId: accountId });
            const userId = user ? user.id : undefined;
            await this.appInstallationDB.recordNewInstallation("github", 'platform', installationId, userId, senderId);
            log.debug({ userId }, "New installation recorded", { userId, platformUserId: ctx.payload.sender.id })
        });
        app.on('installation.deleted', async ctx => {
            const installationId = `${ctx.payload.installation.id}`;
            await this.appInstallationDB.recordUninstallation("github", 'platform', installationId);
        });

        app.on('push', async ctx => {
            await this.handlePushEvent(ctx);
        });

        app.on(['pull_request.opened', 'pull_request.synchronize', 'pull_request.reopened'], async ctx => {
            await this.handlePullRequest(ctx);
        });
    }

    protected async handlePushEvent(ctx: Context): Promise<void> {
        const span = TraceContext.startSpan("GithubApp.handlePushEvent", {});
        span.setTag("request", ctx.id);

        try {
            const user = await this.findUserForInstallation(ctx);
            if (!user) {
                return;
            }
            const logCtx: LogContext = { userId: user.id };

            if (!!user.blocked) {
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

            let config = await this.prebuildManager.fetchConfig({ span }, user, contextURL);
            const runPrebuild = this.appRules.shouldRunPrebuild(config, branch == repo.default_branch, false, false);
            if (!runPrebuild) {
                const reason = `Not running prebuild, the user did not enable it for this context`;
                log.debug(logCtx, reason, { contextURL });
                span.log({ "not-running": reason, "config": config });
                return;
            }

            this.prebuildManager.startPrebuild({ span }, user, contextURL, repo.clone_url, pl.after)
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

    protected async handlePullRequest(ctx: Context): Promise<void> {
        const span = TraceContext.startSpan("GithubApp.handlePullRequest", {});
        span.setTag("request", ctx.id);

        try {
            const user = await this.findUserForInstallation(ctx);
            if (!user) {
                log.warn("Did not find user for installation. Someone's Gitpod experience may be broken.", { repo: ctx.repo() });
                return;
            }

            const pr = ctx.payload.pull_request;
            const contextURL = pr.html_url;
            const config = await this.prebuildManager.fetchConfig({ span }, user, contextURL);

            const prebuildStartPromise = this.onPrStartPrebuild({ span }, config, user, ctx);
            this.onPrAddCheck({ span }, config, user, ctx, prebuildStartPromise);
            this.onPrAddBadge(config, user, ctx);
            this.onPrAddLabel(config, user, ctx, prebuildStartPromise);
            this.onPrAddComment(config, user, ctx);
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async onPrAddCheck(ctx: TraceContext, config: WorkspaceConfig | undefined, user: User, cri: Context, start: Promise<StartPrebuildResult> | undefined) {
        if (!start) {
            return;
        }

        if (!this.appRules.shouldDo(config, 'addCheck')) {
            return;
        }

        const span = TraceContext.startSpan("onPrAddCheck", ctx);
        try {
            const spr = await start;
            const pws = await this.workspaceDB.trace({ span }).findPrebuildByWorkspaceID(spr.wsid);
            if (!pws) {
                return;
            }

            await this.statusMaintainer.registerCheckRun({ span }, cri.payload.installation.id, pws, {
                ...cri.repo(),
                head_sha: cri.payload.pull_request.head.sha,
                details_url: this.env.hostUrl.withContext(cri.payload.pull_request.html_url).toString()
            });
        } catch (err) {
            TraceContext.logError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    protected onPrStartPrebuild(tracecContext: TraceContext, config: WorkspaceConfig | undefined, user: User, ctx: Context): Promise<StartPrebuildResult> | undefined {
        const pr = ctx.payload.pull_request;
        const pr_head = pr.head;
        const contextURL = pr.html_url;
        const cloneURL = pr_head.repo.clone_url;

        const runPrebuild = this.appRules.shouldRunPrebuild(config, false, true, pr.head.repo.id !== pr.base.repo.id);
        let prebuildStartPromise: Promise<StartPrebuildResult> | undefined;
        if (runPrebuild) {
            prebuildStartPromise = this.prebuildManager.startPrebuild(tracecContext, user, contextURL, cloneURL, pr_head.sha);
            prebuildStartPromise.catch(err => log.error(err, "Error while starting prebuild", { contextURL }));
            return prebuildStartPromise;
        } else {
            log.debug({ userId: user.id }, `Not running prebuild, the user did not enable it for this context`, { contextURL });
            return;
        }
    }

    protected onPrAddBadge(config: WorkspaceConfig | undefined, user: User, ctx: Context) {
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

    protected onPrAddLabel(config: WorkspaceConfig | undefined, user: User, ctx: Context, prebuildStartPromise: Promise<StartPrebuildResult> | undefined) {
        const pr = ctx.payload.pull_request;
        if (this.appRules.shouldDo(config, "addLabel") === true) {
            const label =
                config
                    && config.github
                    && config.github.prebuilds
                    && GithubAppPrebuildConfig.is(config.github.prebuilds)
                    && typeof config.github.prebuilds.addLabel === 'string'
                    ? config.github.prebuilds.addLabel as string
                    : "prebuilt-in-gitpod";

            if (ctx.payload.action === 'synchronize') {
                // someone just pushed a commit, remove the label
                const delLabelPromise = ctx.octokit.issues.removeLabel({ ...ctx.repo(), number: pr.number, name: label });
                delLabelPromise.catch(err => log.error(err, "Error while removing label from PR"));
            }

            if (prebuildStartPromise) {
                prebuildStartPromise.then(startWsResult => {
                    if (startWsResult.done) {
                        if (!!startWsResult.didFinish) {
                            const addLabelPromise = ctx.octokit.issues.addLabels({ ...ctx.repo(), number: pr.number, labels: [label] });
                            addLabelPromise.catch(err => log.error(err, "Error while adding label to PR"));
                        }
                    } else {
                        new PrebuildListener(this.messageBus, startWsResult.wsid, evt => {
                            if (!HeadlessWorkspaceEventType.isRunning(evt) && HeadlessWorkspaceEventType.didFinish(evt)) {
                                const addLabelPromise = ctx.octokit.issues.addLabels({ ...ctx.repo(), number: pr.number, labels: [label] });
                                addLabelPromise.catch(err => log.error(err, "Error while adding label to PR"));
                            }
                        });
                    }
                })
            }
        }
    }

    protected async onPrAddComment(config: WorkspaceConfig | undefined, user: User, ctx: Context) {
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

    protected async findUserForInstallation(ctx: Context): Promise<User | undefined> {
        const installation = await this.appInstallationDB.findInstallation("github", ctx.payload.installation.id);
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

        return user;
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

class PrebuildListener {
    protected readonly disposable: Disposable;

    constructor(protected readonly messageBus: MessageBusIntegration, workspaceID: string, protected readonly onBuildDone: (success: HeadlessWorkspaceEventType, msg: string) => void) {
        this.disposable = this.messageBus.listenForHeadlessWorkspaceLogs(workspaceID, this.handleMessage.bind(this));
    }

    protected handleMessage(ctx: TraceContext, evt: HeadlessLogEvent) {
        if (HeadlessWorkspaceEventType.isRunning(evt.type)) {
            return;
        }

        this.onBuildDone(evt.type, evt.text);
        this.disposable.dispose();
    }

}

export interface StartPrebuildResult {
    wsid: string;
    done: boolean;
    didFinish?: boolean;
}
