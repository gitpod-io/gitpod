/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';
import { GitHubTokenProvider } from '../github-token-provider';
import { RepositoryQueryResult, AddPullRequestReviewComment, PageInfo, AddPullRequestReview, SubmitPullRequestReview, DeletePullRequestReview, UpdatePullRequestReviewComment } from './github-protocol';
import { Permissions } from './permissions';
import { GitHubExtension } from '../github-extension';
import { GitHubUtils, QueryResult, GitHubError } from './github';

@injectable()
export class GitHubEndpoint {

    protected readonly pageInfoFragment = `
    pageInfo {
      endCursor
      hasNextPage
    }
  `

    protected readonly repositoryFragment = `
    name,
    owner {
      login
    }
    isFork,
    mergeCommitAllowed,
    rebaseMergeAllowed,
    squashMergeAllowed,
    viewerPermission
  `

    protected readonly defaultBranchFragment = `
    defaultBranchRef {
      name
    }
  `

    protected readonly refFragment = `{
    name,
    repository {${this.repositoryFragment}}
  }`

    protected readonly actorFragment = `{
    avatarUrl,
    login,
    url
  }`

    protected readonly gitActorFragment = `{
    avatarUrl,
    name,
    user ${this.actorFragment}
  }`

    protected readonly commentFragment = `
    id,
    databaseId,
    body,
    bodyHTML,
    createdAt,
    author ${this.actorFragment}
  `

    protected readonly reviewCommentFragment = `{
    diffHunk,
    position,
    path,
    updatedAt,
    publishedAt,
    replyTo {
      id
    },
    ${this.commentFragment}
  }`;

    protected readonly pullRequestFragment = `{
    id,
    title,
    number,
    url,
    state,
    bodyHTML,
    commits {
      totalCount
    }
    author ${this.actorFragment},
    baseRefOid,
    baseRefName,
    baseRef ${this.refFragment},
    headRefOid,
    headRefName,
    headRef ${this.refFragment},
    isCrossRepository,
    repository {${this.repositoryFragment}},
    mergeable,
    merged,
    viewerCanUpdate
  }`

    @inject(GitHubTokenProvider)
    private tokenProvider: GitHubTokenProvider;

    @inject(GitHubExtension)
    protected readonly extension: GitHubExtension;

    protected get host(): string {
        return this.extension.host;
    }

    protected async runQuery<T>(query: string, variables?: object, permissions?: Permissions): Promise<QueryResult<T>> {
        const request = {
            query: query.trim(),
            variables
        };
        const token = await this.getToken(this.host, permissions);
        return GitHubUtils.callAPIv4<T>(request, this.host, token);
    }

    async getToken(host: string, permissions?: Permissions): Promise<string> {
        return await this.tokenProvider.getToken({ host, ...permissions });
    }

    async runBatch(queries: Map<string, string>) {
        type t = { [property: string]: any };
        try {
            return await this.runQuery<t>(`
                {
                  ${Array.from(queries.entries()).map(([key, value]) => `${key}: ${value}`)}
                }
            `);
        } catch (error) {
            if (GitHubError.is<t>(error)) {
                return error.result; // may contain data *and* errors
            }
            throw error; // e.g. timeout
        }
    }

    async getParentRepository({ owner, repository }: GitHubEndpoint.RepositoryOptions) {
        return this.runQuery<RepositoryQueryResult>(`
            {
              repository(owner: "${owner}", name: "${repository}") {
                ${this.repositoryFragment}
                ${this.defaultBranchFragment}
                parent {
                  ${this.repositoryFragment}
                  ${this.defaultBranchFragment}
                }
              }
            }
        `);
    }

    createGetForksQuery({ owner, repository, cursor }: GitHubEndpoint.RepositoryOptions): string {
        return `repository(owner: "${owner}", name: "${repository}") {
      forks(affiliations: [COLLABORATOR, OWNER, ORGANIZATION_MEMBER], first: ${GitHubEndpoint.nodeLimit}${this.after(cursor)}) {
        nodes {
          ${this.repositoryFragment}
          forks(affiliations: [COLLABORATOR, OWNER, ORGANIZATION_MEMBER], first: 1) {
            totalCount
          }
        }
        ${this.pageInfoFragment}
      }
    }
    `
    }

    async getBranches({ owner, repository, cursor }: GitHubEndpoint.RepositoryOptions) {
        return this.runQuery<RepositoryQueryResult>(`
            {
              repository(owner: "${owner}", name: "${repository}") {
                refs(refPrefix: "refs/heads/", first: ${GitHubEndpoint.nodeLimit}${this.after(cursor)}) {
                  nodes {
                    name
                  }
                  ${this.pageInfoFragment}
                }
              }
            }
        `);

    }

    async getPullRequest({ owner, repository, pullRequest }: GitHubEndpoint.GetPullRequestOptions) {
        return this.runQuery<RepositoryQueryResult>(`
            query {
              repository(owner: "${owner}", name: "${repository}") {
                pullRequest(number: ${pullRequest}) ${this.pullRequestFragment}
              }
            }
        `);
    }

    createGetReviewsQuery({ pullRequestId, cursor }: GitHubEndpoint.PullRequestOptions): string {
        return `node(id: "${pullRequestId}") {
              ... on PullRequest {
                reviews(first: ${GitHubEndpoint.nodeLimit}${this.after(cursor)}) {
                  nodes {
                    id
                  }
                  ${this.pageInfoFragment}
                }
              }
            }
        `;
    }

    createGetTimelineQuery({ pullRequestId, cursor }: GitHubEndpoint.PullRequestOptions): string {
        return `node(id: "${pullRequestId}") {
              ... on PullRequest {
                timeline(first: ${GitHubEndpoint.nodeLimit}${this.after(cursor)}) {
                  nodes {
                    __typename,
                    ... on PullRequestReview {
                      id,
                      bodyHTML,
                      author ${this.actorFragment},
                      submittedAt,
                      createdAt,
                      state
                    },
                    ... on Commit {
                      id,
                      abbreviatedOid,
                      authoredByCommitter,
                      author ${this.gitActorFragment},
                      authoredDate,
                      committer ${this.gitActorFragment},
                      committedDate,
                      message,
                      messageHeadlineHTML,
                      pushedDate
                    },
                    ... on IssueComment {
                      ${this.commentFragment}
                    }
                  },
                  ${this.pageInfoFragment}
                }
              }
            }
        `;
    }

    createGetReviewCommentsQuery({ reviewId, cursor }: GitHubEndpoint.ReviewOptions): string {
        return `node(id: "${reviewId}") {
              ... on PullRequestReview {
                comments(first: ${GitHubEndpoint.nodeLimit}${this.after(cursor)}) {
                  nodes ${this.reviewCommentFragment},
                  ${this.pageInfoFragment}
                }
              }
            }
        `;
    }

    async addPullRequestReview(params: AddPullRequestReview.Params) {
        return this.runQuery<AddPullRequestReview.Result>(`
      mutation($params:AddPullRequestReviewInput!) {
        addPullRequestReview(input:$params) {
          pullRequestReview {
            id,
            state,
            __typename
          }
        }
      }
    `, { params });
    }

    async addPullRequestReviewComment(params: AddPullRequestReviewComment.Params) {
        return this.runQuery<AddPullRequestReviewComment.Result>(`
      mutation($params:AddPullRequestReviewCommentInput!) {
        addPullRequestReviewComment(input:$params) {
          comment ${this.reviewCommentFragment}
        }
      }
    `, { params });
    }

    async updatePullRequestReviewComment(params: UpdatePullRequestReviewComment.Params) {
        return this.runQuery<UpdatePullRequestReviewComment.Result>(`
      mutation($params:UpdatePullRequestReviewCommentInput!) {
        updatePullRequestReviewComment(input:$params) {
          pullRequestReviewComment ${this.reviewCommentFragment}
        }
      }
    `, { params });
    }

    async submitPullRequestReview(params: SubmitPullRequestReview.Params) {
        return this.runQuery<SubmitPullRequestReview.Result>(`
      mutation($params:SubmitPullRequestReviewInput!) {
        submitPullRequestReview(input:$params) {
          pullRequestReview {
            id,
            state,
            __typename
          }
        }
      }
    `, { params });
    }

    async deletePullRequestReview(params: DeletePullRequestReview.Params) {
        return this.runQuery<DeletePullRequestReview.Result>(`
      mutation($params:DeletePullRequestReviewInput!) {
        deletePullRequestReview(input:$params) {
          pullRequestReview {
            id,
            state,
            __typename
          }
        }
      }
    `, { params });
    }

    protected after(cursor?: string): string {
        return cursor ? `, after: "${cursor}"` : '';
    }

    async fetchForward(query: (cursor: string) => Promise<PageInfo>): Promise<void> {
        const pageInfo = <PageInfo>{
            hasNextPage: true
        };
        while (pageInfo.hasNextPage) {
            Object.assign(pageInfo, await query(pageInfo.endCursor));
        }
    }

}

export namespace GitHubEndpoint {
    export interface PageOptions {
        cursor?: string
    }
    export interface RepositoryOptions extends PageOptions {
        owner: string,
        repository: string
    }
    export interface GetPullRequestOptions extends RepositoryOptions {
        pullRequest: number
    }
    export interface PullRequestOptions extends PageOptions {
        pullRequestId: string
    }
    export interface ReviewOptions extends PageOptions {
        reviewId: string
    }
    /* https://developer.github.com/v4/guides/resource-limitations/#node-limit */
    export const nodeLimit = 100;
}
