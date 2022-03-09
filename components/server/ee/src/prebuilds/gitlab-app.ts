/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as express from 'express';
import { postConstruct, injectable, inject } from 'inversify';
import { ProjectDB, TeamDB, UserDB } from '@gitpod/gitpod-db/lib';
import { Project, User, StartPrebuildResult, CommitContext, CommitInfo } from '@gitpod/gitpod-protocol';
import { PrebuildManager } from '../prebuilds/prebuild-manager';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { TokenService } from '../../../src/user/token-service';
import { HostContextProvider } from '../../../src/auth/host-context-provider';
import { GitlabService } from './gitlab-service';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { ContextParser } from '../../../src/workspace/context-parser-service';
import { RepoURL } from '../../../src/repohost';

@injectable()
export class GitLabApp {

    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(PrebuildManager) protected readonly prebuildManager: PrebuildManager;
    @inject(TokenService) protected readonly tokenService: TokenService;
    @inject(HostContextProvider) protected readonly hostCtxProvider: HostContextProvider;
    @inject(ProjectDB) protected readonly projectDB: ProjectDB;
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(ContextParser) protected readonly contextParser: ContextParser;

    protected _router = express.Router();
    public static path = '/apps/gitlab/';

    @postConstruct()
    protected init() {
        this._router.post('/', async (req, res) => {
            const event = req.header('X-Gitlab-Event');
            if (event === 'Push Hook') {
                const context = req.body as GitLabPushHook;
                const span = TraceContext.startSpan("GitLapApp.handleEvent", {});
                span.setTag("request", context);
                log.debug("GitLab push hook received", { event, context });
                let user: User | undefined;
                try {
                    user = await this.findUser({ span }, context, req);
                } catch (error) {
                    log.error("Cannot find user.", error, { req })
                }
                if (!user) {
                    res.statusCode = 503;
                    res.send();
                    return;
                }
                await this.handlePushHook({ span }, context, user);
            } else {
                log.debug("Unknown GitLab event received", { event });
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
                throw new Error('No secretToken provided.');
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
            log.debug({ userId: user.id }, "GitLab push hook: Context URL", { context: body, contextURL });
            span.setTag('contextURL', contextURL);
            const context = await this.contextParser.handle({ span }, user, contextURL) as CommitContext;
            const projectAndOwner = await this.findProjectAndOwner(context.repository.cloneUrl, user);
            const config = await this.prebuildManager.fetchConfig({ span }, user, context);
            if (!this.prebuildManager.shouldPrebuild(config)) {
                log.debug({ userId: user.id }, "GitLab push hook: There is no prebuild config.", { context: body, contextURL });
                return undefined;
            }

            log.debug({ userId: user.id }, "GitLab push hook: Starting prebuild", { body, contextURL });

            const commitInfo = await this.getCommitInfo(user, body.repository.git_http_url, body.after);
            const ws = await this.prebuildManager.startPrebuild({ span }, {
                user: projectAndOwner?.user || user,
                project: projectAndOwner?.project,
                context,
                commitInfo
            });

            return ws;
        } finally {
            span.finish();
        }
    }

    private async getCommitInfo(user: User, repoURL: string, commitSHA: string) {
        const parsedRepo = RepoURL.parseRepoUrl(repoURL)!;
        const hostCtx = this.hostCtxProvider.get(parsedRepo.host);
        let commitInfo: CommitInfo | undefined;
        if (hostCtx?.services?.repositoryProvider) {
            commitInfo = await hostCtx?.services?.repositoryProvider.getCommitInfo(user, parsedRepo.owner, parsedRepo.repo, commitSHA);
        }
        return commitInfo;
    }

    /**
     * Finds the relevant user account and project to the provided webhook event information.
     *
     * First of all it tries to find the project for the given `cloneURL`, then it tries to
     * find the installer, which is also supposed to be a team member. As a fallback, it
     * looks for a team member which also has a gitlab.com connection.
     *
     * @param cloneURL of the webhook event
     * @param webhookInstaller the user account known from the webhook installation
     * @returns a promise which resolves to a user account and an optional project.
     */
    protected async findProjectAndOwner(cloneURL: string, webhookInstaller: User): Promise<{ user: User, project?: Project }> {
        const project = await this.projectDB.findProjectByCloneUrl(cloneURL);
        if (project) {
            if (project.userId) {
                const user = await this.userDB.findUserById(project.userId);
                if (user) {
                    return { user, project };
                }
            } else if (project.teamId) {
                const teamMembers = await this.teamDB.findMembersByTeam(project.teamId || '');
                if (teamMembers.some(t => t.userId === webhookInstaller.id)) {
                    return { user: webhookInstaller, project };
                }
                for (const teamMember of teamMembers) {
                    const user = await this.userDB.findUserById(teamMember.userId);
                    if (user && user.identities.some(i => i.authProviderId === "Public-GitLab")) {
                        return { user, project };
                    }
                }
            }
        }
        return { user: webhookInstaller };
    }

    protected createContextUrl(body: GitLabPushHook) {
        const repoUrl = body.repository.git_http_url;
        const contextURL = `${repoUrl.substr(0, repoUrl.length - 4)}/-/tree${body.ref.substr('refs/head/'.length)}`;
        return contextURL;
    }

    get router(): express.Router {
        return this._router;
    }

    protected getBranchFromRef(ref: string): string | undefined {
        const headsPrefix = "refs/heads/";
        if (ref.startsWith(headsPrefix)) {
            return ref.substring(headsPrefix.length);
        }

        return undefined;
    }
}

interface GitLabPushHook {
    object_kind: 'push';
    before: string;
    after: string; // commit
    ref: string; // e.g. "refs/heads/master"
    user_avatar: string;
    user_name: string;
    project: GitLabProject;
    repository: GitLabRepository;
}

interface GitLabRepository {
    name: string,
    git_http_url: string; // e.g. http://example.com/mike/diaspora.git
    visibility_level: number,
}

interface GitLabProject {
    id: number,
    namespace: string,
    name: string,
    path_with_namespace: string, // e.g. "mike/diaspora"
    git_http_url: string; // e.g. http://example.com/mike/diaspora.git
    web_url: string; // e.g. http://example.com/mike/diaspora
    visibility_level: number,
    avatar_url: string | null,
}