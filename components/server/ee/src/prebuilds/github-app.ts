/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Probot, Application, Context } from 'probot';
import { findPrivateKey } from 'probot/lib/private-key';
import * as fs from 'fs-extra';
import { injectable, inject, decorate } from 'inversify';
import { Env } from '../../../src/env';
import { AppInstallationDB } from '@gitpod/gitpod-db/lib/app-installation-db';
import * as express from 'express';
import { UserDB } from '@gitpod/gitpod-db/lib/user-db';
import { log, LogContext } from '@gitpod/gitpod-protocol/lib/util/logging';
import { WorkspaceConfig, User, PrebuiltWorkspaceState, GithubAppPrebuildConfig, Disposable } from '@gitpod/gitpod-protocol';
import { MessageBusIntegration } from '../../../src/workspace/messagebus-integration';
import { WorkspaceDB } from '@gitpod/gitpod-db/lib/workspace-db';
import * as crypto from 'crypto';
import { HeadlessWorkspaceEventType, HeadlessLogEvent } from '@gitpod/gitpod-protocol/lib/headless-workspace-log';
import { GithubAppRules } from './github-app-rules';
import * as Octokit from '@octokit/rest';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { TracedWorkspaceDB, DBWithTracing } from '@gitpod/gitpod-db/lib/traced-db';
import { PrebuildManager } from './prebuild-manager';
import { PrebuildStatusMaintainer } from './prebuilt-status-maintainer';

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
export class GithubApp extends Probot {
    @inject(AppInstallationDB) protected readonly appInstallationDB: AppInstallationDB;
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;
    @inject(MessageBusIntegration) protected readonly messageBus: MessageBusIntegration;
    @inject(GithubAppRules) protected readonly appRules: GithubAppRules;
    @inject(PrebuildManager) protected readonly prebuildManager: PrebuildManager;

    constructor(
        @inject(Env) protected readonly env: Env,
        @inject(PrebuildStatusMaintainer) protected readonly statusMaintainer: PrebuildStatusMaintainer,
    ) {
        super({
            id: env.githubAppAppID,
            cert: GithubApp.loadPrivateKey(env.githubAppCertPath),
            secret: env.githubAppWebhookSecret
        });
        log.debug("Starting GitHub app integration", {
            id: env.githubAppAppID,
            cert: env.githubAppCertPath,
            secret: env.githubAppWebhookSecret
        })

        this.load(this.buildApp.bind(this));
    }

    protected async buildApp(app: Application) {
        this.statusMaintainer.start(async id => (await app.auth(parseInt(id))) as any as Octokit);
        // this.queueMaintainer.start();

        app.route('/pbs').get('/*', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            let status: PrebuiltWorkspaceState | 'failed' | undefined;

            try {
                const segments = req.path.split('/');
                if (segments.length >= 3) {
                    const cloneURL = `https://${segments.slice(1, segments.length - 1).join('/')}`;
                    const commitWithSuffix = segments[segments.length - 1];
                    const commit = commitWithSuffix.substring(0, commitWithSuffix.length - '.svg'.length);

                    const pws = await this.workspaceDB.trace({}).findPrebuiltWorkspaceByCommit(cloneURL, commit);
                    if (pws) {
                        status = pws.state;
                        if (status === 'available' && pws.error) {
                            status = 'failed';
                        }
                    }
                }
            } catch (err) {
                log.info("error while serving prebuild status image", err);
            }


            const btn = this.buildReviewButton(status);
            const btnhash = crypto.createHmac('sha1', "this-does-not-matter")
                .update(btn)
                .digest('hex')

            res.status(200);
            res.header("content-type", "image/svg+xml");
            res.header("Cache-Control", "no-cache");
            res.header("ETag", btnhash)
            res.send(btn);
        });

        app.on('installation.created', async ctx => {
            const authId: string = ctx.payload.installation.account.id;
            const user = await this.userDB.findUserByIdentity({ authProviderId: this.env.githubAppAuthProviderId, authId });
            const userId = user ? user.id : undefined;
            await this.appInstallationDB.recordNewInstallation("github", 'platform', ctx.payload.installation.id, userId, ctx.payload.sender.id);
            log.debug({ userId }, "New installation recorded", { userId, platformUserId: ctx.payload.sender.id })
        });
        app.on('installation.deleted', async ctx => {
            await this.appInstallationDB.recordUninstallation("github", 'platform', ctx.payload.installation.id);
        });

        app.on('push', async ctx => {
            await this.handlePushEvent(ctx);
        });

        app.on(['pull_request.opened', 'pull_request.synchronize', 'pull_request.reopened'], async ctx => {
            await this.handlePullRequest(ctx);
        });
    }

    protected buildReviewButton(status?: PrebuiltWorkspaceState | 'failed') {
        let color = '#1966D2';
        if (status === 'aborted' || status === 'failed' || status === 'timeout') {
            color = '#d4273e';
        } else if (status === 'building') {
            color = '#586069';
        }

        return `<svg width="150px" height="32px" viewBox="0 0 1500 320" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
    <g id="button">
        <rect id="Background" fill="${color}" x="0" y="0" width="1500" height="320" rx="40"></rect>
        <text id="in-Gitpod" opacity="0.703985305" font-family="Helvetica" font-size="140" font-weight="normal" fill="#FFFFFF">
            <tspan x="850" y="210">in Gitpod</tspan>
        </text>
        <text id="Code" font-family="Helvetica" font-size="140" font-weight="normal" fill="#FFFFFF">
            <tspan x="350" y="210">Review</tspan>
        </text>

        <g id="logo" fill="#FFFFFF" transform="translate(112.000000, 57.000000)">
            <polygon id="Path" points="17.74 144.58 17.74 63.57 0 53.33 0 154.76 0 154.77 87.77 205.43 87.77 184.7"></polygon>
            <polygon id="Path" points="87.77 163.95 87.77 104 35.74 73.96 35.74 134.15"></polygon>
            <polygon id="Path" points="89.35 20.55 159.49 60.97 177.21 50.74 89.35 0 1.49 50.73 19.27 60.99"></polygon>
            <polygon id="Path" points="141.48 71.37 89.36 41.33 37.27 71.38 89.35 101.45"></polygon>
            <polygon id="Path" points="90.77 164.06 143.02 134.14 143.02 113.66 107.01 134.15 107.01 113.44 161.02 82.7 161.02 144.58 90.77 184.79 90.77 205.53 178.7 154.78 178.7 154.78 178.7 154.77 178.7 53.35 90.77 104.1"></polygon>
            <polygon id="Path" points="89.35 103.18 89.35 103.19 89.35 103.19 89.35 103.19 89.35 103.18 89.35 103.18"></polygon>
        </g>
    </g>
</g>
</svg>`
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
            this.onPrAddCheck({span}, config, user, ctx, prebuildStartPromise);
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
            const pws = await this.workspaceDB.trace({span}).findPrebuildByWorkspaceID(spr.wsid);
            if (!pws) {
                return;
            }

            await this.statusMaintainer.registerCheckRun({span}, cri.payload.installation.id, pws, {
                ...cri.repo(),
                head_sha: cri.payload.pull_request.head.sha,
                details_url: this.env.hostUrl.withContext(cri.payload.pull_request.html_url).toString()
            });
        } catch (err) {
            TraceContext.logError({span}, err);
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
        const pr = ctx.payload.pull_request;
        const pr_head = pr.head;
        const cloneURL = pr_head.repo.clone_url;
        const contextURL = pr.html_url;

        const body: string = pr.body;
        const oldBadge = this.getBadgeImageURL(cloneURL, ctx.payload.before);
        const newBadge = this.getBadgeImageURL(cloneURL, pr_head.sha);
        let newBody = body.replace(oldBadge, newBadge);
        let updatePRBody = this.appRules.shouldDo(config, 'addBadge');
        if (newBody === body && oldBadge !== newBadge) {
            // we did not replace anything in the text despite the URLs being different -> the button is not yet in the comment
            newBody += `\n\n<a href="${this.env.hostUrl.withContext(contextURL)}"><img src="${this.getBadgeImageURL(cloneURL, pr_head.sha)}" /></a>\n\n`;
        } else {
            // we had previously added the badge to this PR - now we must keep it up to date even if we do not add badges to new PRs anymore
            updatePRBody = true;
        }
        if (updatePRBody) {
            const updatePrPromise: Promise<void> = (ctx.github as any).pullRequests.update({ ...ctx.repo(), number: pr.number, body: newBody });
            updatePrPromise.catch(err => log.error(err, "Error while updating PR body", { contextURL: contextURL }));
        }
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
                const delLabelPromise: Promise<void> = (ctx.github as any).issues.removeLabel({ ...ctx.repo(), number: pr.number, name: label });
                delLabelPromise.catch(err => log.error(err, "Error while removing label from PR"));
            }

            if (prebuildStartPromise) {
                prebuildStartPromise.then(startWsResult => {
                    if (startWsResult.done) {
                        if (!!startWsResult.didFinish) {
                            const addLabelPromise: Promise<void> = (ctx.github as any).issues.addLabels({ ...ctx.repo(), number: pr.number, labels: [label] });
                            addLabelPromise.catch(err => log.error(err, "Error while adding label to PR"));
                        }
                    } else {
                        new PrebuildListener(this.messageBus, startWsResult.wsid, evt => {
                            if (!HeadlessWorkspaceEventType.isRunning(evt) && HeadlessWorkspaceEventType.didFinish(evt)) {
                                const addLabelPromise: Promise<void> = (ctx.github as any).issues.addLabels({ ...ctx.repo(), number: pr.number, labels: [label] });
                                addLabelPromise.catch(err => log.error(err, "Error while adding label to PR"));
                            }
                        });
                    }
                })
            }
        }
    }

    protected async onPrAddComment(config: WorkspaceConfig | undefined, user: User, ctx: Context) {
        const pr = ctx.payload.pull_request;
        const pr_head = pr.head;
        const cloneURL = pr_head.repo.clone_url;
        const contextURL = pr.html_url;

        const oldBadge = this.getBadgeImageURL(cloneURL, ctx.payload.before);
        const newBadge = this.getBadgeImageURL(cloneURL, pr_head.sha);

        const comments = await ((ctx.github as any).issues.listComments(ctx.issue()) as Promise<any>);
        const existingComment = comments.data.find((c: any) => c.body.indexOf(oldBadge) > -1);
        if (existingComment) {
            const promise: Promise<void> = (ctx.github as any).issues.updateComment(ctx.issue({ comment_id: existingComment.id, body: existingComment.body.replace(oldBadge, newBadge) }));
            promise.catch(err => log.error(err, "Error while updating PR comment", { contextURL: contextURL }));
        } else if (this.appRules.shouldDo(config, 'addComment')) {
            const body = `\n\n<a href="${this.env.hostUrl.withContext(contextURL)}"><img src="${newBadge}" /></a>\n\n`;
            const newComment = ctx.issue({ body });
            const newCommentPromise: Promise<void> = (ctx.github as any).issues.createComment(newComment);
            newCommentPromise.catch(err => log.error(err, "Error while adding new PR comment", { contextURL: contextURL }));
        }
    }

    protected getBadgeImageURL(cloneURL: string, commit: string): string {
        if (cloneURL.startsWith("https://")) {
            cloneURL = cloneURL.substring("https://".length);
        }
        const name = `${cloneURL}/${commit}.svg`;
        return this.env.hostUrl.withApi({ pathname: `/apps/github/pbs/${name}` }).toString();
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
        if (filename && fs.existsSync(filename)) {
            const key = findPrivateKey(filename);
            if (key) {
                return key.toString();
            }
        }
    }

}

class PrebuildListener {
    protected readonly disposable: Promise<Disposable>;

    constructor(protected readonly messageBus: MessageBusIntegration, workspaceID: string, protected readonly onBuildDone: (success: HeadlessWorkspaceEventType, msg: string) => void) {
        this.disposable = this.messageBus.listenForHeadlessWorkspaceLogs(workspaceID, this.handleMessage.bind(this));
    }

    protected async handleMessage(ctx: TraceContext, evt: HeadlessLogEvent) {
        if (HeadlessWorkspaceEventType.isRunning(evt.type)) {
            return;
        }

        this.onBuildDone(evt.type, evt.text);
        (await this.disposable).dispose();
    }

}

export interface StartPrebuildResult {
    wsid: string;
    done: boolean;
    didFinish?: boolean;
}
