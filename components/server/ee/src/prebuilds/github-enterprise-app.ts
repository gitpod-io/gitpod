/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as express from 'express';
import { createHmac } from 'crypto';
import { postConstruct, injectable, inject } from 'inversify';
import { ProjectDB, TeamDB, UserDB } from '@gitpod/gitpod-db/lib';
import { PrebuildManager } from '../prebuilds/prebuild-manager';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { TokenService } from '../../../src/user/token-service';
import { HostContextProvider } from '../../../src/auth/host-context-provider';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { CommitContext, CommitInfo, Project, StartPrebuildResult, User } from '@gitpod/gitpod-protocol';
import { GitHubService } from './github-service';
import { URL } from 'url';
import { ContextParser } from '../../../src/workspace/context-parser-service';
import { RepoURL } from '../../../src/repohost';

@injectable()
export class GitHubEnterpriseApp {

    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(PrebuildManager) protected readonly prebuildManager: PrebuildManager;
    @inject(TokenService) protected readonly tokenService: TokenService;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(ProjectDB) protected readonly projectDB: ProjectDB;
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(ContextParser) protected readonly contextParser: ContextParser;

    protected _router = express.Router();
    public static path = '/apps/ghe/';

    @postConstruct()
    protected init() {
        this._router.post('/', async (req, res) => {
            const event = req.header('X-Github-Event');
            if (event === 'push') {
                const payload = req.body as GitHubEnterprisePushPayload;
                const span = TraceContext.startSpan("GitHubEnterpriseApp.handleEvent", {});
                span.setTag("payload", payload);
                let user: User | undefined;
                try {
                    user = await this.findUser({ span }, payload, req);
                } catch (error) {
                    log.error("Cannot find user.", error, { req })
                }
                if (!user) {
                    res.statusCode = 401;
                    res.send();
                    return;
                }
                await this.handlePushHook({ span }, payload, user);
            } else {
                log.info("Unknown GitHub Enterprise event received", { event });
            }
            res.send('OK');
        });
    }

    protected async findUser(ctx: TraceContext, payload: GitHubEnterprisePushPayload, req: express.Request): Promise<User> {
        const span = TraceContext.startSpan("GitHubEnterpriseApp.findUser", ctx);
        try {
            const host = req.header('X-Github-Enterprise-Host');
            const hostContext = this.hostContextProvider.get(host || '');
            if (!host || !hostContext) {
                throw new Error('Unsupported GitHub Enterprise host: ' + host);
            }
            const { authProviderId } = hostContext.authProvider;
            const authId = payload.sender.id;
            const user = await this.userDB.findUserByIdentity({ authProviderId, authId });
            if (!user) {
                throw new Error(`No user found with identity ${authProviderId}/${authId}.`);
            } else if (!!user.blocked) {
                throw new Error(`Blocked user ${user.id} tried to start prebuild.`);
            }
            const gitpodIdentity = user.identities.find(i => i.authProviderId === TokenService.GITPOD_AUTH_PROVIDER_ID);
            if (!gitpodIdentity) {
                throw new Error(`User ${user.id} has no identity for '${TokenService.GITPOD_AUTH_PROVIDER_ID}'.`);
            }
            // Verify the webhook signature
            const signature = req.header('X-Hub-Signature-256');
            const body = (req as any).rawBody;
            const tokenEntries = (await this.userDB.findTokensForIdentity(gitpodIdentity)).filter(tokenEntry => {
                return tokenEntry.token.scopes.includes(GitHubService.PREBUILD_TOKEN_SCOPE);
            });
            const signingToken = tokenEntries.find(tokenEntry => {
                const sig = 'sha256=' + createHmac('sha256', user.id + '|' + tokenEntry.token.value)
                    .update(body)
                    .digest('hex');
                return sig === signature;
            });
            if (!signingToken) {
                throw new Error(`User ${user.id} has no token matching the payload signature.`);
            }
            return user;
        } finally {
            span.finish();
        }
    }

    protected async handlePushHook(ctx: TraceContext, payload: GitHubEnterprisePushPayload, user: User): Promise<StartPrebuildResult | undefined> {
        const span = TraceContext.startSpan("GitHubEnterpriseApp.handlePushHook", ctx);
        try {
            const contextURL = this.createContextUrl(payload);
            span.setTag('contextURL', contextURL);
            const context = await this.contextParser.handle({ span }, user, contextURL) as CommitContext;
            const config = await this.prebuildManager.fetchConfig({ span }, user, context);
            if (!this.prebuildManager.shouldPrebuild(config)) {
                log.info('GitHub Enterprise push event: No config. No prebuild.');
                return undefined;
            }

            log.debug('GitHub Enterprise push event: Starting prebuild.', { contextURL });

            const cloneURL = payload.repository.clone_url;
            const projectAndOwner = await this.findProjectAndOwner(cloneURL, user);
            const commitInfo = await this.getCommitInfo(user, payload.repository.url, payload.after);
            const ws = await this.prebuildManager.startPrebuild({ span }, {
                context,
                user: projectAndOwner.user,
                project: projectAndOwner?.project,
                commitInfo
            });
            return ws;
        } finally {
            span.finish();
        }
    }

    private async getCommitInfo(user: User, repoURL: string, commitSHA: string) {
        const parsedRepo = RepoURL.parseRepoUrl(repoURL)!;
        const hostCtx = this.hostContextProvider.get(parsedRepo.host);
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
     * looks for a team member which also has a connection with this GitHub Enterprise server.
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
                const hostContext = this.hostContextProvider.get(new URL(cloneURL).host);
                const authProviderId = hostContext?.authProvider.authProviderId;
                for (const teamMember of teamMembers) {
                    const user = await this.userDB.findUserById(teamMember.userId);
                    if (user && user.identities.some(i => i.authProviderId === authProviderId)) {
                        return { user, project };
                    }
                }
            }
        }
        return { user: webhookInstaller };
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
