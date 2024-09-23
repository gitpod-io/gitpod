/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { Authorizer } from "../authorization/authorizer";
import { Config } from "../config";
import { TokenProvider } from "../user/token-provider";
import { CommitContext, Project, SuggestedRepository, Token, WorkspaceInfo } from "@gitpod/gitpod-protocol";
import { HostContextProvider } from "../auth/host-context-provider";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { AuthProviderService } from "../auth/auth-provider-service";
import { UserService } from "../user/user-service";
import { GitTokenScopeGuesser } from "../workspace/git-token-scope-guesser";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import {
    SuggestedRepositoryWithSorting,
    sortSuggestedRepositories,
    suggestionFromProject,
    suggestionFromRecentWorkspace,
    suggestionFromUserRepo,
} from "../workspace/suggested-repos-sorter";

@injectable()
export class ScmService {
    constructor(
        @inject(Config) protected readonly config: Config,
        @inject(Authorizer) private readonly auth: Authorizer,
        @inject(TokenProvider) private readonly tokenProvider: TokenProvider,
        @inject(HostContextProvider) private readonly hostContextProvider: HostContextProvider,
        @inject(AuthProviderService) private readonly authProviderService: AuthProviderService,
        @inject(UserService) private readonly userService: UserService,
        @inject(GitTokenScopeGuesser) private readonly gitTokenScopeGuesser: GitTokenScopeGuesser,
    ) {}

    /**
     * `getToken` allows clients to retrieve SCM tokens based on the specified host.
     *
     * @param userId subject and current user.
     * @param query specifies the `host` of the auth provider to search for a token.
     * @returns promise which resolves to a `Token`, or `undefined` if no token for the specified user and host exists.
     *
     * @throws 404/NOT_FOUND if the user is not found.
     */
    public async getToken(userId: string, query: { host: string }): Promise<Token | undefined> {
        // FIXME(at) this doesn't sound right. "token" is pretty overloaded, thus `read_scm_tokens` would be correct
        await this.auth.checkPermissionOnUser(userId, "read_tokens", userId);
        const { host } = query;
        const token = await this.tokenProvider.getTokenForHost(userId, host);
        return token;
    }

    /**
     * `guessTokenScopes` allows clients to retrieve scopes that would be necessary for a specified
     * git operation on a specified repository.
     *
     * This method requires the same permissions as `getToken`. If no token is found, this will
     * return the default scopes for the provider of the specified host.
     *
     * @throws 404/NOT_FOUND if the user is not found.
     * @throws 404/NOT_FOUND if the provider is not found.
     */
    public async guessTokenScopes(
        userId: string,
        params: { host: string; repoUrl: string; gitCommand: string },
    ): Promise<{ scopes?: string[]; message?: string }> {
        const { host, repoUrl, gitCommand } = params;

        const user = await this.userService.findUserById(userId, userId);

        const provider = await this.authProviderService.findAuthProviderDescription(user, host);
        if (!provider) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Auth provider not found.`);
        }

        const token = await this.getToken(userId, { host });
        const currentToken = token?.value;
        return await this.gitTokenScopeGuesser.guessGitTokenScopes(provider, {
            host,
            repoUrl,
            gitCommand,
            currentToken,
        });
    }

    public async searchRepositories(userId: string, params: { searchString: string; limit?: number }) {
        const user = await this.userService.findUserById(userId, userId);
        const hosts = (await this.authProviderService.getAuthProviderDescriptions(user)).map((p) => p.host);

        const limit: number = params.limit || 30;

        const providerRepos = await Promise.all(
            hosts.map(async (host): Promise<SuggestedRepositoryWithSorting[]> => {
                try {
                    const hostContext = this.hostContextProvider.get(host);
                    const services = hostContext?.services;
                    if (!services) {
                        return [];
                    }
                    const repos = await services.repositoryProvider.searchRepos(user, params.searchString, limit);

                    return repos.map((r) =>
                        suggestionFromUserRepo({
                            url: r.url.replace(/\.git$/, ""),
                            repositoryName: r.name,
                        }),
                    );
                } catch (error) {
                    log.warn("Could not search repositories from host " + host, error);
                }

                return [];
            }),
        );

        const sortedRepos = sortSuggestedRepositories(providerRepos.flat());

        //return only the first 'limit' results
        return sortedRepos.slice(0, limit).map(
            (repo): SuggestedRepository => ({
                url: repo.url,
                repositoryName: repo.repositoryName,
            }),
        );
    }

    public async listSuggestedRepositories(
        userId: string,
        params: {
            projectsPromise: Promise<Project[]>;
            workspacesPromise: Promise<WorkspaceInfo[]>;
        },
    ) {
        const user = await this.userService.findUserById(userId, userId);
        const logCtx = { userId: user.id };

        const fetchProjects = async (): Promise<SuggestedRepositoryWithSorting[]> => {
            const projects = await params.projectsPromise;

            const projectRepos = projects.map((project) => {
                return suggestionFromProject({
                    url: project.cloneUrl.replace(/\.git$/, ""),
                    projectId: project.id,
                    projectName: project.name,
                });
            });

            return projectRepos;
        };

        // Load user repositories (from Git hosts directly)
        const fetchUserRepos = async (): Promise<SuggestedRepositoryWithSorting[]> => {
            const authProviders = await this.authProviderService.getAuthProviderDescriptions(user);

            const providerRepos = await Promise.all(
                authProviders.map(async (p): Promise<SuggestedRepositoryWithSorting[]> => {
                    try {
                        const hostContext = this.hostContextProvider.get(p.host);
                        const services = hostContext?.services;
                        if (!services) {
                            log.error(logCtx, "Unsupported repository host: " + p.host);
                            return [];
                        }
                        const userRepos = await services.repositoryProvider.getUserRepos(user);

                        return userRepos.map((r) =>
                            suggestionFromUserRepo({
                                url: r.url.replace(/\.git$/, ""),
                                repositoryName: r.name,
                            }),
                        );
                    } catch (error) {
                        log.debug(logCtx, "Could not get user repositories from host " + p.host, error);
                    }

                    return [];
                }),
            );

            return providerRepos.flat();
        };

        const fetchRecentRepos = async (): Promise<SuggestedRepositoryWithSorting[]> => {
            const workspaces = await params.workspacesPromise;
            const recentRepos: SuggestedRepositoryWithSorting[] = [];

            for (const ws of workspaces) {
                let repoUrl;
                let repoName;
                if (CommitContext.is(ws.workspace.context)) {
                    repoUrl = ws.workspace.context?.repository?.cloneUrl?.replace(/\.git$/, "");
                    repoName = ws.workspace.context?.repository?.name;
                }
                if (!repoUrl) {
                    repoUrl = ws.workspace.contextURL;
                }
                if (repoUrl) {
                    const lastUse = WorkspaceInfo.lastActiveISODate(ws);

                    recentRepos.push(
                        suggestionFromRecentWorkspace(
                            {
                                url: repoUrl,
                                repositoryName: repoName ?? "",
                                projectId: ws.workspace.projectId,
                            },
                            lastUse,
                        ),
                    );
                }
            }
            return recentRepos;
        };

        const repoResults = await Promise.allSettled([
            fetchProjects().catch((e) => log.error(logCtx, "Could not fetch projects", e)),
            fetchUserRepos().catch((e) => log.error(logCtx, "Could not fetch user repositories", e)),
            fetchRecentRepos().catch((e) => log.error(logCtx, "Could not fetch recent repositories", e)),
        ]);

        const sortedRepos = sortSuggestedRepositories(
            repoResults.flatMap((r) => (r.status === "fulfilled" ? r.value || [] : [])),
        );

        // Convert to SuggestedRepository (drops sorting props)
        return sortedRepos.map(
            (repo): SuggestedRepository => ({
                url: repo.url,
                projectId: repo.projectId,
                projectName: repo.projectName,
                repositoryName: repo.repositoryName,
            }),
        );
    }
}
