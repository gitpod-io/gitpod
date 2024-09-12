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
import { toBranch, toRepository } from "./azure-converter";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

@injectable()
export class AzureDevOpsContextParser extends AbstractContextParser implements IContextParser {
    @inject(AzureDevOpsApi) protected readonly azureDevOpsApi: AzureDevOpsApi;
    @inject(AzureDevOpsTokenHelper) protected readonly tokenHelper: AzureDevOpsTokenHelper;

    public async handle(ctx: TraceContext, user: User, contextUrl: string): Promise<WorkspaceContext> {
        const span = TraceContext.startSpan("AzureDevOpsContextParser", ctx);
        span.setTag("contextUrl", contextUrl);

        try {
            const { host, owner, repoName, moreSegments, searchParams } = await this.parseURL(user, contextUrl);
            if (moreSegments.length > 0) {
                switch (moreSegments[0]) {
                    case "pullrequest": {
                        return await this.handlePullRequestContext(
                            user,
                            host,
                            owner,
                            repoName,
                            parseInt(moreSegments[1]),
                        );
                    }
                    case "commit": {
                        return await this.handleCommitContext(user, host, owner, repoName, moreSegments[1]);
                    }
                    default: {
                        const version = searchParams.get("version");
                        if (!version) {
                            break;
                        }
                        if (version.startsWith("GB")) {
                            return await this.handleBranchContext(user, host, owner, repoName, version.slice(2));
                        }
                        if (version.startsWith("GT")) {
                            return await this.handleTagContext(user, host, owner, repoName, version.slice(2));
                        }
                    }
                }
            }

            return await this.handleDefaultContext(user, host, owner, repoName);
        } catch (error) {
            // TODO(hw): [AZ] proper handle errors
            // if (error && error.code === 401) {
            //     const token = await this.tokenHelper.getCurrentToken(user);
            //     throw UnauthorizedError.create({
            //         host: this.config.host,
            //         providerType: "Gitlab",
            //         requiredScopes: GitLabScope.Requirements.DEFAULT,
            //         repoName: RepoURL.parseRepoUrl(contextUrl)?.repo,
            //         providerIsConnected: !!token,
            //         isMissingScopes: containsScopes(token?.scopes, GitLabScope.Requirements.DEFAULT),
            //     });
            // }
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
        if (segments.length < 4 || segments[2] !== "_git") {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Invalid Azure DevOps URL");
        }
        // const azOrganization = segments[0];
        const azProject = segments[1];
        const repo = segments[3];
        return {
            host,
            owner: azProject,
            repoName: repo,
            moreSegments: segments.slice(4),
            searchParams: url.searchParams,
        };
    }

    // https://dev.azure.com/services-azure/test-project/_git/repo2
    protected async handleDefaultContext(
        user: User,
        host: string,
        azProject: string,
        repo: string,
    ): Promise<NavigatorContext> {
        try {
            const repository = await this.azureDevOpsApi.getRepository(user, azProject, repo);
            const result: NavigatorContext = {
                path: "",
                isFile: false,
                title: `${azProject}/${repo}`,
                repository: toRepository(repository),
                revision: "",
            };
            if (!repository.defaultBranch) {
                return result;
            }
            try {
                const branch = toBranch(
                    await this.azureDevOpsApi.getBranch(user, azProject, repo, repository.defaultBranch),
                );
                if (!branch) {
                    return result;
                }
                result.revision = branch.commit.sha;
                result.title = `${result.title} - ${branch.name}`;
                result.ref = branch.name;
                // TODO(hw): [AZ] support other refType
                result.refType = "revision";
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
        azProject: string,
        repo: string,
        pr: number,
    ): Promise<PullRequestContext> {
        const pullRequest = await this.azureDevOpsApi.getPullRequest(user, azProject, repo, pr);
        const sourceRepo = toRepository(pullRequest.forkSource?.repository ?? pullRequest.repository!);
        const targetRepo = toRepository(pullRequest.repository!);
        const result: PullRequestContext = {
            nr: pr,
            base: {
                repository: targetRepo,
                ref: pullRequest.targetRefName!.replace("refs/headers/", ""),
                refType: "branch",
            } as any as PullRequestContext["base"],
            title: "",
            repository: sourceRepo,
            ref: pullRequest.sourceRefName!.replace("refs/headers/", ""),
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
        azProject: string,
        repo: string,
        branch: string,
    ): Promise<NavigatorContext> {
        const [repository, branchInfo] = await Promise.all([
            this.azureDevOpsApi.getRepository(user, azProject, repo),
            this.azureDevOpsApi.getBranch(user, azProject, repo, branch),
        ]);
        const result: NavigatorContext = {
            path: "",
            ref: branch,
            refType: "branch",
            // TODO(hw): [AZ] verify if empty repo will be broken or not
            revision: branchInfo.commit?.commitId ?? "",
            isFile: false,
            title: `${azProject}/${repo} - ${branch}`,
            repository: toRepository(repository),
        };
        return result;
    }

    // tag: v0.0.1
    // https://dev.azure.com/services-azure/test-project/_git/repo2-fork?version=GTv0.0.1
    // https://dev.azure.com/services-azure/test-project/_git/repo2-fork?version=GTv0.0.1&path=/.gitpod.yml
    protected async handleTagContext(
        user: User,
        host: string,
        azProject: string,
        repo: string,
        tag: string,
    ): Promise<NavigatorContext> {
        const [repository, tagCommit] = await Promise.all([
            this.azureDevOpsApi.getRepository(user, azProject, repo),
            this.azureDevOpsApi.getTagCommit(user, azProject, repo, tag),
        ]);
        const result: NavigatorContext = {
            path: "",
            ref: tag,
            refType: "tag",
            revision: tagCommit.commitId!,
            isFile: false,
            title: `${azProject}/${repo} - ${tag}`,
            repository: toRepository(repository),
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
        azProject: string,
        repo: string,
        commit: string,
    ): Promise<NavigatorContext> {
        const [repoInfo, commitInfo] = await Promise.all([
            this.azureDevOpsApi.getRepository(user, azProject, repo),
            this.azureDevOpsApi.getCommit(user, azProject, repo, commit),
        ]);
        const result: NavigatorContext = {
            path: "",
            ref: "",
            refType: "revision",
            revision: commitInfo.commitId!,
            isFile: false,
            title: `${azProject}/${repo} - ${commitInfo.comment}`,
            // @ts-ignore
            owner: azProject,
            repository: toRepository(repoInfo),
        };
        return result;
    }
}
