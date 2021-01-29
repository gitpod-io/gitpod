/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject, postConstruct } from "inversify";
import { AuthProviderInfo } from "@gitpod/gitpod-protocol/lib/protocol";
import { GitpodInfoService, GitpodInfo } from "../common/gitpod-info";
import { GitpodServiceProvider } from "./gitpod-service-provider";
import { MessageService } from "@theia/core/lib/common/message-service";
import { WindowService } from "@theia/core/lib/browser/window/window-service";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { GitpodGitTokenValidator } from "./gitpod-git-token-validator";

export interface GetGitTokenParams {
    gitCommand?: string
    host: string
    repoURL?: string
    scopes?: string[];
    message?: string;
}

export interface GetGitTokenResult {
    token: string;
    user: string;
    scopes: string[];
}

interface TokenValidationParams extends GetGitTokenParams { }


@injectable()
export class GitpodGitTokenProvider {

    @inject(GitpodGitTokenValidator) protected tokenValidator: GitpodGitTokenValidator;
    @inject(GitpodInfoService) protected infoProvider: GitpodInfoService;
    @inject(GitpodServiceProvider) protected serviceProvider: GitpodServiceProvider;
    @inject(MessageService) protected readonly messageService: MessageService;
    @inject(WindowService) protected readonly windowService: WindowService;

    protected authProviders: AuthProviderInfo[];
    protected gitpodInfo: GitpodInfo;

    @postConstruct()
    protected async init() {
        const { server } = this.serviceProvider.getService();
        const [gitpodInfo, authProviders] = await Promise.all([this.infoProvider.getInfo(), server.getAuthProviders()]);
        this.gitpodInfo = gitpodInfo;
        this.authProviders = authProviders;
    }

    /**
     * @param params.host hostname of git server
     *
     * @param params.scopes (optional) direct request for a token with specific permissions
     *
     * @param params.gitComand (optional) e.g. "push" or "fetch" (parsed from git command)
     * @param params.repoURL (optional) e.g. https://github.com/eclipse-theia/theia (parsed from git command)
     */
    async getGitToken(params: GetGitTokenParams): Promise<GetGitTokenResult> {
        const validationParams: TokenValidationParams = { ...params };

        let token = await this.getTokenFromServer(params.host);
        if (!token && params.repoURL) {
            const url = new URL(params.repoURL);
            const pathSegments = url.pathname.split("/");
            const hostAndPath = `${url.host}/${pathSegments[0] || pathSegments[1]}`;
            token = await this.getTokenFromServer(hostAndPath);
        }
        if (token) {
            const tokenUser = token.username || "oauth2";
            // if required scopes are missing, we can validate async
            const result = { user: tokenUser, token: token.value, scopes: token.scopes };

            /* don't await */ this.validateRepoAccessWithTokenAsync(validationParams, result);

            return result;
        }

        /* don't await */ this.validateWithoutAuthorizationAsync(validationParams);

        // token was not found, thus we return just a dummy to satisfy the git protocol
        return { user: "oauth2", token: "no", scopes: [] } as GetGitTokenResult;
    }

    protected async getTokenFromServer(gitHost: string) {
        const { server } = this.serviceProvider.getService();
        const token = await server.getToken({ host: gitHost });
        return token;
    }

    protected async validateWithoutAuthorizationAsync(params: TokenValidationParams) {
        const { host, message } = params;
        const authProvider = this.getAuthProvider(host);
        if (!authProvider) {
            // TODO warn about unknown host
            return;
        }

        const defaults = authProvider.requirements && authProvider.requirements.default;
        const missingScopes = defaults ? defaults.join(',') : undefined;
        const notificationMessage = message ? message : `Please try again after granting permissions to access "${host}".`;
        await this.showMessage(notificationMessage, host, missingScopes);
    }

    protected getAuthProvider(host: string) {
        const authProvider = this.authProviders.find(p => p.host === host);
        return authProvider;
    }

    /**
     *
     * @param params.scopes in case `getGitToken` was called for a specific action
     * @param params.gitCommand in case `getGitToken` for called from CLI
     * @param tokenResult Gitpod user has already granted permissions, which needs to be checked here
     */
    protected async validateRepoAccessWithTokenAsync(params: TokenValidationParams, tokenResult: GetGitTokenResult) {
        const { host, repoURL, gitCommand, scopes, message } = params;

        // 1. in case of a direct request for a token with specific permissions ...
        if (scopes) {
            const missingScopes = this.getMissingScopes(scopes, tokenResult.scopes);
            if (missingScopes.length > 0) {
                const messagePart = `An operation requires additional permissions: ${missingScopes.join(", ")}`;
                const notificationMessage = message ? message : `${messagePart} Please try again after updating the permissions.`;
                await this.showMessage(notificationMessage, host, missingScopes.join(','));
            }
            return;
        }

        const repoFullName = repoURL && this.parseRepoFull(repoURL);
        const authProvider = this.getAuthProvider(host);
        if (!gitCommand || !repoFullName || !authProvider) {
            // a generic warning might be of interest
            // - unknown git operation or repo
            // - unknown git host
            return;
        }

        // 2. in case of git operation which require write access to a remote
        if (gitCommand === "push") {

            const validationResult = await this.tokenValidator.checkWriteAccess(authProvider, repoFullName, tokenResult);
            const hasWriteAccess = validationResult && validationResult.writeAccessToRepo === true;

            if (hasWriteAccess) {

                // first of all check if the current token includes write permission
                const isPublic = validationResult && !validationResult.isPrivateRepo;
                const requiredScopesForGitCommand = isPublic ? authProvider.requirements!.publicRepo : authProvider.requirements!.privateRepo;
                const missingScopes = this.getMissingScopes(requiredScopesForGitCommand, tokenResult.scopes);
                if (missingScopes.length > 0) {
                    const messagePart = `The command "git ${gitCommand}" requires additional permissions: ${missingScopes.join(", ")}`;
                    const notificationMessage = message ? message : `${messagePart} Please try again after updating the permissions.`;
                    await this.showMessage(notificationMessage, host, missingScopes.join(','));
                }
            } else {

                // warn about missing write access
                const notificationMessage = `The remote repository "${repoFullName}" is not accessible with the current token.
                Please make sure Gitpod is authorized for the organization this repository belongs to.`;
                await this.showMessage(notificationMessage, host);
            }

        }
    }
    protected getMissingScopes(required: string[], actual: string[]) {
        const missingScopes = new Set<string>(required);
        actual.forEach(s => missingScopes.delete(s));
        return Array.from(missingScopes);
    }

    /**
     * @returns full name of the repo, e.g. group/subgroup1/subgroug2/project-repo
     *
     * @param repoURL e.g. https://gitlab.domain.com/group/subgroup1/subgroug2/project-repo.git
     */
    protected parseRepoFull(repoURL: string | undefined): string | undefined {
        if (repoURL && repoURL.startsWith("https://") && repoURL.endsWith(".git")) {
            const parts = repoURL.substr("https://".length).split("/").splice(1); // without host parts
            if (parts.length >= 2) {
                parts[parts.length - 1] = parts[parts.length - 1].slice(0, -1 * ".git".length);
                return parts.join("/");
            }
        }
        return undefined;
    }

    protected async showMessage(message: string, host: string, scopes?: string) {
        const action = !!scopes ? "Grant Permissions" : "Manage Access";
        const result = await this.messageService.error(message, { timeout: 0 }, action);
        if (result === action) {
            const hostUrl = new GitpodHostUrl(this.gitpodInfo.host);
            const accessControlUrl = hostUrl.asAccessControl();
            if (scopes) {
                const returnToAccessControlUrl = accessControlUrl.with({ search: `updated=${host}@${scopes}` }).toString();
                const search = `returnTo=${encodeURIComponent(returnToAccessControlUrl)}&host=${host}&scopes=${scopes}`;
                const url = hostUrl.withApi({
                    pathname: '/authorize',
                    search
                }).toString();
                this.windowService.openNewWindow(url);
            } else {
                this.windowService.openNewWindow(accessControlUrl.with({ search: `toBeReviewed=${host}` }).toString());
            }
        }
    }

}