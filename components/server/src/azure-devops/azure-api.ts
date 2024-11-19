/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { Commit, User } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

import { AuthProviderParams } from "../auth/auth-provider";
import { AzureDevOpsTokenHelper } from "./azure-token-helper";
import { WebApi, getHandlerFromToken } from "azure-devops-node-api";
import { MaybeContent } from "../repohost";
import { GitVersionDescriptor, GitVersionType } from "azure-devops-node-api/interfaces/GitInterfaces";
import { AzureDevOpsOAuthScopes } from "@gitpod/public-api-common/lib/auth-providers";
import { RepositoryNotFoundError } from "@gitpod/public-api-common/lib/public-api-errors";
import { IncomingMessage } from "node:http";

@injectable()
export class AzureDevOpsApi {
    @inject(AuthProviderParams) readonly config: AuthProviderParams;
    @inject(AzureDevOpsTokenHelper) protected readonly tokenHelper: AzureDevOpsTokenHelper;

    private async create(userOrToken: User | string, opts: { serverUrl?: string; orgId?: string } = {}) {
        if (!opts.serverUrl && !opts.orgId) {
            throw new Error("Either serverUrl or orgId must be provided");
        }
        let bearerToken: string | undefined;
        if (typeof userOrToken === "string") {
            bearerToken = userOrToken;
        } else {
            const azureToken = await this.tokenHelper.getTokenWithScopes(userOrToken, AzureDevOpsOAuthScopes.DEFAULT);
            bearerToken = azureToken.value;
        }
        return new WebApi(
            opts.serverUrl ?? `https://${this.config.host}/${opts.orgId}`,
            getHandlerFromToken(bearerToken),
        );
    }

    private async createGitApi(userOrToken: User | string, orgId: string) {
        const api = await this.create(userOrToken, { orgId });
        return api.getGitApi();
    }

    private getVersionDescriptor(commit: Pick<Commit, "ref" | "refType" | "revision">): GitVersionDescriptor {
        const result: GitVersionDescriptor = {};
        if (commit.refType === "revision") {
            result.versionType = GitVersionType.Commit;
            result.version = commit.revision;
        }
        if (commit.refType === "branch") {
            result.versionType = GitVersionType.Branch;
            result.version = commit.ref;
        }
        if (commit.refType === "tag") {
            result.versionType = GitVersionType.Tag;
            result.version = commit.ref;
        }
        return result;
    }

    /**
     *
     * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/git/commits/get-commits
     */
    async getCommits(
        userOrToken: User | string,
        azOrgId: string,
        azProject: string,
        repository: string,
        opts?: Partial<{
            filterCommit: Pick<Commit, "ref" | "refType" | "revision">;
            $top: number;
            itemPath: string;
        }>,
    ) {
        const gitApi = await this.createGitApi(userOrToken, azOrgId);
        return gitApi.getCommits(
            repository,
            {
                itemVersion: opts?.filterCommit ? this.getVersionDescriptor(opts.filterCommit) : undefined,
                $top: opts?.$top,
                itemPath: opts?.itemPath,
            },
            azProject,
        );
    }

    /**
     * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/git/items/get
     */
    async getFileContent(
        userOrToken: User | string,
        azOrgId: string,
        azProject: string,
        repository: string,
        commit: Pick<Commit, "repository" | "ref" | "refType" | "revision">,
        path: string,
    ): Promise<MaybeContent> {
        const gitApi = await this.createGitApi(userOrToken, azOrgId);
        const azPath = "/" + path;
        try {
            const readableStream = await gitApi.getItemContent(
                repository,
                azPath,
                azProject,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                this.getVersionDescriptor(commit),
            );
            const err = AzureReadableStreamError.tryCreate(readableStream);
            if (err) {
                throw err;
            }
            let content = "";
            for await (const chunk of readableStream) {
                content += chunk.toString();
            }
            return content;
        } catch (err) {
            if (err instanceof AzureReadableStreamError) {
                if (err.statusCode === 404) {
                    return undefined;
                }
                throw err;
            }
            log.error("Error while fetching file content", err);
            throw new Error(`Failed to fetch file content: ${err}`);
        }
    }

    /**
     * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/git/repositories/list
     */
    async getRepositories(userOrToken: User | string, azOrgId: string, azProject: string) {
        const gitApi = await this.createGitApi(userOrToken, azOrgId);
        return gitApi.getRepositories(azProject);
    }

    /**
     * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/git/repositories/get-repository
     */
    async getRepository(userOrToken: User | string, azOrgId: string, azProject: string, repository: string) {
        const gitApi = await this.createGitApi(userOrToken, azOrgId);
        const repo = await gitApi.getRepository(repository, azProject);
        if (!repo) {
            throw new RepositoryNotFoundError({
                host: this.config.host,
                owner: `${azOrgId}/${azProject}`,
                repoName: repository,
                userIsOwner: false,
                userScopes: [],
                lastUpdate: "",
                errorMessage: "Repository not found.",
            });
        }
        return repo;
    }

    async getBranches(
        userOrToken: User | string,
        azOrgId: string,
        azProject: string,
        repository: string,
        opts?: { filterBranch?: string },
    ) {
        const gitApi = await this.createGitApi(userOrToken, azOrgId);
        // If not found, sdk will return null
        return (
            (await gitApi.getBranches(
                repository,
                azProject,
                opts?.filterBranch
                    ? this.getVersionDescriptor({ ref: opts.filterBranch, refType: "branch", revision: "" })
                    : undefined,
            )) ?? []
        );
    }

    async getBranch(
        userOrToken: User | string,
        azOrgId: string,
        azProject: string,
        repository: string,
        branch: string,
    ) {
        const gitApi = await this.createGitApi(userOrToken, azOrgId);
        return gitApi.getBranch(repository, branch, azProject);
    }

    async getTagCommit(
        userOrToken: User | string,
        azOrgId: string,
        azProject: string,
        repository: string,
        tag: string,
    ) {
        const commits = await this.getCommits(userOrToken, azOrgId, azProject, repository, {
            filterCommit: { ref: tag, refType: "tag", revision: "" },
            $top: 1,
        });
        if (commits.length === 0) {
            throw new Error(`Tag ${tag} not found`);
        }
        return commits[0];
    }

    /**
     * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/git/commits/get
     */
    async getCommit(
        userOrToken: User | string,
        azOrgId: string,
        azProject: string,
        repository: string,
        commitId: string,
    ) {
        const gitApi = await this.createGitApi(userOrToken, azOrgId);
        return gitApi.getCommit(commitId, repository, azProject);
    }

    /**
     * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get-pull-request?view=azure-devops-rest-7.1
     */
    async getPullRequest(
        userOrToken: User | string,
        azOrgId: string,
        azProject: string,
        repository: string,
        prId: number,
    ) {
        const gitApi = await this.createGitApi(userOrToken, azOrgId);
        return gitApi.getPullRequest(repository, prId, azProject);
    }

    /**
     * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/profile/profiles/get
     */
    async getAuthenticatedUser(userOrToken: User | string) {
        const api = await this.create(userOrToken, { serverUrl: "https://app.vssps.visualstudio.com" });
        const profileApi = await api.getProfileApi();
        // official <Profile> interface has no `displayName` field although it's exists in the response
        const profile = await profileApi.getProfile("me", true);
        const anyProfile = profile as Partial<{ displayName: string; emailAddress: string; publicAlias: string }>;
        return {
            id: profile.id,
            displayName: anyProfile.displayName ?? profile.coreAttributes["DisplayName"]?.value,
            publicAlias: anyProfile.publicAlias ?? profile.coreAttributes["PublicAlias"]?.value,
            emailAddress: anyProfile.emailAddress ?? profile.coreAttributes["EmailAddress"]?.value,
            avatar: profile.coreAttributes["Avatar"]?.value?.value,
            /**
             * The time at which this profile was last changed.
             */
            timeStamp: profile.timeStamp,
        };
    }
}

export class AzureReadableStreamError extends Error {
    constructor(message: string, public statusCode?: number) {
        super(message);
    }

    private static isIncomingMessage(stream: NodeJS.ReadableStream): stream is IncomingMessage {
        return "statusCode" in stream && typeof (stream as any).statusCode === "number";
    }

    static tryCreate(stream: NodeJS.ReadableStream): AzureReadableStreamError | undefined {
        if (AzureReadableStreamError.isIncomingMessage(stream)) {
            if (stream.statusCode === 200) {
                return;
            }
            return new AzureReadableStreamError(`HTTP ${stream.statusCode} ${stream.statusMessage}`, stream.statusCode);
        }
    }
}
