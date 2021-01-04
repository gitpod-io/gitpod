/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import { GetGitTokenResult } from "./gitpod-git-token-provider";
import { AuthProviderInfo } from "@gitpod/gitpod-protocol";
import { GitHubUtils, GitHubResult, GitHub, GitHubError } from "./github/github-model/github";
import { Bitbucket } from "bitbucket";

export interface CheckWriteAccessResult {
    found: boolean;
    isPrivateRepo?: boolean;
    writeAccessToRepo?: boolean;
    mayWritePrivate?: boolean;
    mayWritePublic?: boolean;
    error?: any;
}

@injectable()
export class GitpodGitTokenValidator {

    async checkWriteAccess(authProvider: AuthProviderInfo, repoFullName: string, tokenResult: GetGitTokenResult): Promise<CheckWriteAccessResult | undefined> {
        const { host, authProviderType } = authProvider;
        const { token } = tokenResult;

        if (authProviderType === "GitHub") {
            return this.checkWriteAccessForGitHubRepo(token, host, repoFullName);
        }
        if (authProviderType === "GitLab") {
            return this.checkWriteAccessForGitLabRepo(token, host, repoFullName);
        }
        if (authProviderType === "Bitbucket") {
            return this.checkWriteAccessForBitbucketRepo(token, host, repoFullName);
        }

        return undefined;
    }

    async checkWriteAccessForGitHubRepo(token: string, host: string, repoFullName: string): Promise<CheckWriteAccessResult> {
        const parsedRepoName = this.parseGitHubRepoName(repoFullName);
        if (!parsedRepoName) {
            throw new Error(`Could not parse repo name: ${repoFullName}`);
        }
        const api = GitHubUtils.createAPIv3(host, token);

        let repo: GitHub.Response<GitHub.ReposGetResponse>;
        try {
            repo = await api.repos.get(parsedRepoName);
        } catch (error) {
            if (error && error.status && error.status === 404) {
                return { found: false };
            }
            return { found: false, error };
        }

        const mayWritePrivate = GitHubResult.mayWritePrivate(repo);
        const mayWritePublic = GitHubResult.mayWritePublic(repo);

        const isPrivateRepo = repo.data.private;
        let writeAccessToRepo = repo.data.permissions.push;
        const inOrg = repo.data.owner.type === "Organization";

        if (inOrg) {
            // if this repository belongs to an organization and Gitpod is not authorized,
            // we're not allowed to list repositories using this a token issues for
            // Gitpod's OAuth App.

            const request = {
                query: `
                query {
                    organization(login: "${parsedRepoName.owner}") {
                        repositories(first: 1) {
                            totalCount
                        }
                    }
                }
                `.trim()
            };
            try {
                await GitHubUtils.callAPIv4(request, host, token);
            } catch (error) {
                let is401 = false;
                if (GitHubError.is(error)) {
                    const errors = error.result.errors;
                    if (errors && errors[0] && (errors[0] as any)["type"] === "FORBIDDEN") {
                        is401 = true;
                    }
                }
                if (is401) {
                    writeAccessToRepo = false;
                } else {
                    throw error;
                }
            }
        }
        return {
            found: true,
            isPrivateRepo,
            writeAccessToRepo,
            mayWritePrivate,
            mayWritePublic
        }
    }
    protected parseGitHubRepoName(repoFullName: string) {
        const parts = repoFullName.split("/");
        if (parts.length === 2) {
            return {
                owner: parts[0],
                repo: parts[1]
            }
        }
    }

    async checkWriteAccessForGitLabRepo(token: string, host: string, repoFullName: string): Promise<CheckWriteAccessResult> {
        let found = false;
        let isPrivateRepo: boolean | undefined;
        let writeAccessToRepo: boolean | undefined;

        try {
            const request = {
                query: `query {project(fullPath: "${repoFullName}") { visibility, userPermissions{ pushCode } } } `
            };
            const response = await fetch(`https://${host}/api/graphql`, {
                method: "POST",
                body: JSON.stringify(request),
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
            if (response.ok) {
                found = true;
                const json = await response.json();
                const project = json.data && json.data.project;
                if (project) {
                    isPrivateRepo = project.visibility !== "public";
                    const pushCode = project.userPermissions && project.userPermissions.pushCode;
                    writeAccessToRepo = pushCode === true;
                }
            } else {
                throw new Error(response.statusText);
            }
        } catch (e) {
            console.error(e);
            throw e;
        }

        return {
            found,
            isPrivateRepo,
            writeAccessToRepo,
            mayWritePrivate: true,
            mayWritePublic: true
        }
    }

    async checkWriteAccessForBitbucketRepo(token: string, host: string, repoFullName: string): Promise<CheckWriteAccessResult> {
        try {
            const result: CheckWriteAccessResult = {
                found: false,
                isPrivateRepo: undefined,
                writeAccessToRepo: undefined,
                mayWritePrivate: true,
                mayWritePublic: true
            };

            const options = {
                auth: { token: token },
                baseUrl: `https://api.${host}/2.0`,
            };
            const api = new Bitbucket(options);
            const repos = (await api.user.listPermissionsForRepos({ q: `repository.full_name="${repoFullName}"` })).data.values

            if (repos && repos.length > 0) {
                if (repos.length > 1) {
                    console.warn(`checkWriteAccessForBitbucketRepo: Found more than one repo for ${repoFullName}.`);
                }
                result.found = true;
                result.isPrivateRepo = repos[0].repository!.is_private;
                const matchingRepo = repos.find(r => r.permission == "write" || r.permission == "admin");
                if (matchingRepo) {
                    result.writeAccessToRepo = true;
                }
            }

            return result;
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

}
