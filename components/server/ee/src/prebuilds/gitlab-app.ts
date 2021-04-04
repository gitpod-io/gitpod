/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as express from 'express';
import { postConstruct, injectable, inject } from 'inversify';
import { UserDB } from '@gitpod/gitpod-db/lib/user-db';
import { User } from '@gitpod/gitpod-protocol';
import { PrebuildManager } from '../prebuilds/prebuild-manager';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { StartPrebuildResult } from './github-app';
import { TokenService } from '../../../src/user/token-service';
import { HostContextProvider } from '../../../src/auth/host-context-provider';
import { GitlabService } from './gitlab-service';

@injectable()
export class GitLabApp {

    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(PrebuildManager) protected readonly prebuildManager: PrebuildManager;
    @inject(TokenService) protected readonly tokenService: TokenService;
    @inject(HostContextProvider) protected readonly hostCtxProvider: HostContextProvider;

    protected _router = express.Router();
    public static path = '/apps/gitlab/';

    @postConstruct()
    protected init() {
        this._router.post('/', async (req, res) => {
            console.log(req.header('X-Gitlab-Event'));
            if (req.header('X-Gitlab-Event') === 'Push Hook') {
                const context = req.body as GitLabPushHook;
                const span = TraceContext.startSpan("GitLapApp.handleEvent", {});
                span.setTag("request", context);
                console.log(JSON.stringify(context, undefined, '  '));
                const user = await this.findUser({span},context, req);
                if (!user) {
                    res.statusCode = 503;
                    res.send();
                    return;
                }
                this.handlePushHook({span},context, user);
            }
            res.send('OK');
        });
    }

    protected async findUser(ctx: TraceContext, context: GitLabPushHook, req: express.Request): Promise<User> {
        const span = TraceContext.startSpan("GitLapApp.findUser", ctx);
        try {
            const secretToken = req.header('X-Gitlab-Token');
            span.setTag('secret-token', secretToken);
            if (!secretToken) {
                throw new Error('No sceretToken provided.');
            }
            const [userid, tokenValue] = secretToken.split('|');
            const user = await this.userDB.findUserById(userid);
            if (!user) {
                throw new Error('No user found for ' + secretToken + ' found.');
            } else if (!!user.blocked) {
                throw new Error(`Blocked user ${user.id} tried to start prebuild.`);
            }
            const identity = user.identities.find(i => i.authProviderId === TokenService.GITPOD_AUTH_PROVIDER_ID);
            if (!identity) {
                throw new Error(`User ${user.id} has no identity for '${TokenService.GITPOD_AUTH_PROVIDER_ID}'.`);
            }
            const tokens = await this.userDB.findTokensForIdentity(identity);
            const token = tokens.find(t => t.token.value === tokenValue);
            if (!token) {
                throw new Error(`User ${user.id} has no token with given value.`);
            }
            if (token.token.scopes.indexOf(GitlabService.PREBUILD_TOKEN_SCOPE) === -1 ||
                token.token.scopes.indexOf(context.repository.git_http_url) === -1) {
                    throw new Error(`The provided token is not valid for the repository ${context.repository.git_http_url}.`);
            }
            return user;
        } finally {
            span.finish();
        }
    }

    protected async handlePushHook(ctx: TraceContext, body: GitLabPushHook, user: User): Promise<StartPrebuildResult | undefined> {
        const span = TraceContext.startSpan("GitLapApp.handlePushHook", ctx);
        try {
            const contextURL = this.createContextUrl(body);
            span.setTag('contextURl', contextURL);
            const config = await this.prebuildManager.fetchConfig({ span }, user, contextURL);
            if (!this.prebuildManager.shouldPrebuild(config)) {
                console.log('No config. No prebuild.');
                return undefined;
            }

            console.log('Starting prebuild.', { contextURL, commit: body.after, gitUrl: body.repository.git_http_url })
            const ws = await this.prebuildManager.startPrebuild({ span }, user, contextURL, body.repository.git_http_url, body.after);
            return ws;
        } finally {
            span.finish();
        }
    }

    protected createContextUrl(body: GitLabPushHook) {
        const repoUrl = body.repository.git_http_url;
        const contextUrl = `${repoUrl.substr(0, repoUrl.length - 4)}/tree${body.ref.substr('refs/head/'.length)}`;
        console.log(contextUrl);
        return contextUrl;
    }

    get router(): express.Router {
        return this._router;
    }
}

interface GitLabPushHook {
    object_kind: 'push';
    before: string;
    after: string; // commit
    ref: string; // branch
    repository: GitLabRepository;
}

interface GitLabRepository {
    git_http_url: string; //e.g. http://example.com/mike/diaspora.git
}