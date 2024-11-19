/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";

import { AzureDevOpsApi } from "./azure-api";
import { IContextParser, AbstractContextParser, URLParts } from "../workspace/context-parser";
import { AzureDevOpsTokenHelper } from "./azure-token-helper";
import { NavigatorContext, PullRequestContext, User, WorkspaceContext } from "@gitpod/gitpod-protocol";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { NotFoundError, UnauthorizedError } from "../errors";
import { getOrgAndProject, normalizeBranchName, toBranch, toRepository } from "./azure-converter";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { AuthProviderParams } from "../auth/auth-provider";
import { AzureDevOpsOAuthScopes } from "@gitpod/public-api-common/lib/auth-providers";
import { RepoURL } from "../repohost";
import { containsScopes } from "../prebuilds/token-scopes-inclusion";

@injectable()
export class AzureDevOpsContextParser extends AbstractContextParser implements IContextParser {
    @inject(AzureDevOpsApi) protected readonly azureDevOpsApi: AzureDevOpsApi;
    @inject(AzureDevOpsTokenHelper) protected readonly tokenHelper: AzureDevOpsTokenHelper;
    @inject(AuthProviderParams) readonly config: AuthProviderParams;

    public async handle(ctx: TraceContext, user: User, contextUrl: string): Promise<WorkspaceContext> {
        const span = TraceContext.startSpan("AzureDevOpsContextParser", ctx);
        span.setTag("contextUrl", contextUrl);

        try {
            const {
                host,
                owner: orgAndProject,
                repoName,
                moreSegments,
                searchParams,
            } = await this.parseURL(user, contextUrl);
            const [azOrganization, azProject] = getOrgAndProject(orgAndProject);
            if (moreSegments.length > 0) {
                switch (moreSegments[0]) {
                    case "pullrequest": {
                        return await this.handlePullRequestContext(
                            user,
                            host,
                            azOrganization,
                            azProject,
                            repoName,
                            parseInt(moreSegments[1]),
                        );
                    }
                    case "commit": {
                        return await this.handleCommitContext(
                            user,
                            host,
                            azOrganization,
                            azProject,
                            repoName,
                            moreSegments[1],
                        );
                    }
                }
            }

            const version = searchParams.get("version");
            if (version) {
                if (version.startsWith("GB")) {
                    return await this.handleBranchContext(
                        user,
                        host,
                        azOrganization,
                        azProject,
                        repoName,
                        version.slice(2),
                    );
                }
                if (version.startsWith("GT")) {
                    return await this.handleTagContext(
                        user,
                        host,
                        azOrganization,
                        azProject,
                        repoName,
                        version.slice(2),
                    );
                }
            }

            return await this.handleDefaultContext(user, host, azOrganization, azProject, repoName);
        } catch (error) {
            if (error && error.statusCode === 401) {
                const token = await this.tokenHelper.getCurrentToken(user);
                throw UnauthorizedError.create({
                    host: this.config.host,
                    providerType: "AzureDevOps",
                    requiredScopes: AzureDevOpsOAuthScopes.DEFAULT,
                    repoName: RepoURL.parseRepoUrl(contextUrl)?.repo,
                    providerIsConnected: !!token,
                    isMissingScopes: containsScopes(token?.scopes, AzureDevOpsOAuthScopes.DEFAULT),
                });
            }
            log.debug("AzureDevOps context parser: Failed to parse.", error);
            throw error;
        } finally {
            span.finish();
        }
    }

    public async parseURL(user: User, contextUrl: string): Promise<URLParts> {
        const url = new URL(contextUrl);
        const pathname = url.pathname.replace(/^\//, "").replace(/\/$/, "");
        const segments = pathname.split("/").filter((e) => e !== "");
        const host = this.host;
        let azOrganization = "";
        let azProject = "";
        let repo = "";
        let moreSegments: string[] = [];
        if (segments.length === 2) {
            // https://dev.azure.com/services-azure/empty-project
            azOrganization = segments[0];
            azProject = segments[1];
            repo = azProject;
        } else if (segments.length === 3 && segments[1] === "_git") {
            // https://dev.azure.com/services-azure/_git/project2
            azOrganization = segments[0];
            azProject = segments[2];
            repo = azProject;
            moreSegments = segments.slice(3);
        } else if (segments.length < 4 || segments[2] !== "_git") {
            // https://dev.azure.com/services-azure/project2/_git/project2
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Invalid Azure DevOps repository URL");
        } else {
            moreSegments = segments.slice(4);
            azOrganization = segments[0];
            azProject = segments[1];
            repo = segments[3];
        }
        return {
            host,
            owner: `${azOrganization}/${azProject}`,
            repoName: repo,
            moreSegments,
            searchParams: url.searchParams,
        };
    }

    // https://dev.azure.com/services-azure/test-project/_git/repo2
    protected async handleDefaultContext(
        user: User,
        host: string,
        azOrganization: string,
        azProject: string,
        repo: string,
    ): Promise<NavigatorContext> {
        try {
            const repository = await this.azureDevOpsApi.getRepository(user, azOrganization, azProject, repo);
            const result: NavigatorContext = {
                path: "",
                isFile: false,
                title: `${azProject}/${repo}`,
                repository: toRepository(this.config.host, repository, azOrganization),
                revision: "",
            };
            if (!repository.defaultBranch) {
                return result;
            }
            try {
                const branchName = normalizeBranchName(repository.defaultBranch);
                const branch = toBranch(
                    result.repository,
                    await this.azureDevOpsApi.getBranch(user, azOrganization, azProject, repo, branchName),
                );
                if (!branch) {
                    return result;
                }
                result.revision = branch.commit.sha;
                result.title = `${result.title} - ${branchName}`;
                result.ref = branchName;
                result.refType = "branch";
                return result;
            } catch (error) {
                // TODO(hw): [AZ] specific error handling
                log.error("Failed to fetch default branch", error);
                throw error;
            }
        } catch (error) {
            if (UnauthorizedError.is(error)) {
                throw error;
            }
            throw await NotFoundError.create(
                await this.tokenHelper.getCurrentToken(user),
                user,
                host,
                azProject,
                repo,
                error.message,
            );
        }
    }

    // PR
    // https://dev.azure.com/services-azure/test-project/_git/repo2/pullrequest/1
    protected async handlePullRequestContext(
        user: User,
        host: string,
        azOrganization: string,
        azProject: string,
        repo: string,
        pr: number,
    ): Promise<PullRequestContext> {
        const pullRequest = await this.azureDevOpsApi.getPullRequest(user, azOrganization, azProject, repo, pr);
        const sourceRepo = toRepository(
            this.config.host,
            pullRequest.forkSource?.repository ?? pullRequest.repository!,
            azOrganization,
        );

        const targetRepo = toRepository(this.config.host, pullRequest.repository!, azOrganization);
        const result: PullRequestContext = {
            nr: pr,
            base: {
                repository: targetRepo,
                ref: normalizeBranchName(pullRequest.targetRefName!),
                refType: "branch",
            } as any as PullRequestContext["base"],
            title: pullRequest.title ?? `${targetRepo.name} #${pr}`,
            repository: sourceRepo,
            ref: normalizeBranchName(pullRequest.sourceRefName!),
            refType: "branch",
            revision: pullRequest.lastMergeSourceCommit!.commitId!,
        };
        return result;
    }

    // branch: develop-2
    // https://dev.azure.com/services-azure/test-project/_git/repo2?path=%2F&version=GBdevelop-2&_a=contents
    // https://dev.azure.com/services-azure/test-project/_git/repo2?path=/.gitpod.yml&version=GBdevelop-2&_a=contents
    // https://dev.azure.com/services-azure/test-project/_git/repo2-fork?path=/src/index.js&version=GBdevelop-2
    protected async handleBranchContext(
        user: User,
        host: string,
        azOrganization: string,
        azProject: string,
        repo: string,
        branch: string,
    ): Promise<NavigatorContext> {
        const [repository, branchInfo] = await Promise.all([
            this.azureDevOpsApi.getRepository(user, azOrganization, azProject, repo),
            this.azureDevOpsApi.getBranch(user, azOrganization, azProject, repo, branch),
        ]);
        const result: NavigatorContext = {
            path: "",
            ref: branch,
            refType: "branch",
            // TODO(hw): [AZ] verify if empty repo will be broken or not
            revision: branchInfo.commit?.commitId ?? "",
            isFile: false,
            title: `${azProject}/${repo} - ${branch}`,
            repository: toRepository(this.config.host, repository, azOrganization),
        };
        return result;
    }

    // tag: v0.0.1
    // https://dev.azure.com/services-azure/test-project/_git/repo2-fork?version=GTv0.0.1
    // https://dev.azure.com/services-azure/test-project/_git/repo2-fork?version=GTv0.0.1&path=/.gitpod.yml
    protected async handleTagContext(
        user: User,
        host: string,
        azOrganization: string,
        azProject: string,
        repo: string,
        tag: string,
    ): Promise<NavigatorContext> {
        const [repository, tagCommit] = await Promise.all([
            this.azureDevOpsApi.getRepository(user, azOrganization, azProject, repo),
            this.azureDevOpsApi.getTagCommit(user, azOrganization, azProject, repo, tag),
        ]);
        const result: NavigatorContext = {
            path: "",
            ref: tag,
            refType: "tag",
            revision: tagCommit.commitId!,
            isFile: false,
            title: `${azProject}/${repo} - ${tag}`,
            repository: toRepository(this.config.host, repository, azOrganization),
        };
        return result;
    }

    // commit
    // https://dev.azure.com/services-azure/test-project/_git/repo2-fork/commit/4c47246a2eacd9700aab401902775c248e85aee7
    // https://dev.azure.com/services-azure/test-project/_git/repo2-fork/commit/4c47246a2eacd9700aab401902775c248e85aee7?refName=refs%2Fheads%2Fdevelop
    // https://dev.azure.com/services-azure/test-project/_git/repo2-fork/commit/4c47246a2eacd9700aab401902775c248e85aee7?refName=refs/heads/develop&path=/.gitpod.yml
    protected async handleCommitContext(
        user: User,
        host: string,
        azOrganization: string,
        azProject: string,
        repo: string,
        commit: string,
    ): Promise<NavigatorContext> {
        const [repoInfo, commitInfo] = await Promise.all([
            this.azureDevOpsApi.getRepository(user, azOrganization, azProject, repo),
            this.azureDevOpsApi.getCommit(user, azOrganization, azProject, repo, commit),
        ]);
        const result: NavigatorContext = {
            path: "",
            ref: "",
            refType: "revision",
            revision: commitInfo.commitId!,
            isFile: false,
            title: `${azProject}/${repo} - ${commitInfo.comment}`,
            // @ts-ignore
            owner: `${azOrganization}/${azProject}`,
            repository: toRepository(this.config.host, repoInfo, azOrganization),
        };
        return result;
    }
}
