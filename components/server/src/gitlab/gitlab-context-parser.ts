/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';

import {
  NavigatorContext,
  User,
  CommitContext,
  Repository,
  PullRequestContext,
  IssueContext,
  RefType,
} from '@gitpod/gitpod-protocol';
import { GitLabApi, GitLab } from './api';
import { UnauthorizedError, NotFoundError } from '../errors';
import { GitLabScope } from './scopes';
import { IContextParser, IssueContexts, AbstractContextParser, URLParts } from '../workspace/context-parser';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { GitLabTokenHelper } from './gitlab-token-helper';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
const path = require('path');
import { URL } from 'url';

@injectable()
export class GitlabContextParser extends AbstractContextParser implements IContextParser {
  @inject(GitLabApi) protected readonly gitlabApi: GitLabApi;
  @inject(GitLabTokenHelper) protected readonly tokenHelper: GitLabTokenHelper;

  protected get authProviderId() {
    return this.config.id;
  }

  public async handle(ctx: TraceContext, user: User, contextUrl: string): Promise<CommitContext> {
    const span = TraceContext.startSpan('GitlabContextParser', ctx);
    span.setTag('contextUrl', contextUrl);

    try {
      const { host, owner, repoName, moreSegments } = await this.parseURL(user, contextUrl);
      if (moreSegments.length > 0) {
        switch (moreSegments[0]) {
          case 'merge_requests': {
            return await this.handlePullRequestContext(user, host, owner, repoName, parseInt(moreSegments[1]));
          }
          case 'tree':
          case 'blob':
          case 'commits': {
            return await this.handleTreeContext(user, host, owner, repoName, moreSegments.slice(1));
          }
          case 'issues': {
            return await this.handleIssueContext(user, host, owner, repoName, parseInt(moreSegments[1]));
          }
          case 'commit': {
            return await this.handleCommitContext(user, host, owner, repoName, moreSegments[1]);
          }
        }
      }

      return await this.handleDefaultContext(user, host, owner, repoName);
    } catch (error) {
      if (error && error.code === 401) {
        const token = await this.tokenHelper.getCurrentToken(user);
        if (token) {
          const scopes = token.scopes;
          // most likely the token needs to be updated after revoking by user.
          throw UnauthorizedError.create(this.config.host, scopes, 'http-unauthorized');
        }
        throw UnauthorizedError.create(this.config.host, GitLabScope.Requirements.REPO);
      }
      throw error;
    } finally {
      span.finish();
    }
  }

  public async parseURL(user: User, contextUrl: string): Promise<URLParts> {
    var { host, owner, repoName, moreSegments, searchParams } = await super.parseURL(user, contextUrl);
    // TODO: we remove the /-/ in the path in the next line as quick fix for #3809 -- improve this in the long term
    const segments = [owner, repoName, ...moreSegments.filter((s) => s !== '-')]
      // Replace URL encoded '#' sign. Don't use decodeURI() because GitLab seems to be inconsistent in what needs to be decoded and what not.
      .map((x) => x.replace(/%23/g, '#'));
    var moreSegmentsStart: number = 2;
    /*
            We cannot deduce the namespace (aka `owner`) and project name (aka `repoName`) from the URI with certainty.

            Consider the folling context URL:
            - https://gitlab.com/mygroup/foobar/issues
            This could be a link to the issues page of the project `foobar` in `mygroup` or
            a project with name `issues` in the subgroup `foobar` of the group `mygroup`.

            GitLab started to use `/-/` as delimiter between project name and pages, e.g. gitlab.com/<owner>/<projectname>/-/job/
            but not for all pages yet. See the following discussion for more information:
            - https://gitlab.com/gitlab-org/gitlab-foss/issues/25893
            - https://gitlab.com/gitlab-org/gitlab-foss/issues/26407

            Therefore we try it by calling the API to ask if this is a project or not and adding another path segments step by step.
        */
    for (var i = 1; i < segments.length; ++i) {
      owner = segments.slice(0, i).join('/');
      repoName = segments[i];
      moreSegmentsStart = i + 1;
      const lastSegmentIncluded = i === segments.length - 1;
      if (lastSegmentIncluded) {
        // Don't try to fetch repo for performance reasons on last try.
        // This is the last possible split for owner/repo.
        // If this isn't the correct split the context URL is invalid and we will figure it out later.
      } else {
        try {
          await this.fetchRepo(user, `${owner}/${repoName}`);
          // no exception: project found
          break;
        } catch (err) {
          // do nothing, try next segmentation
        }
      }
    }
    const endsWithRepoName = segments.length === moreSegmentsStart;
    return {
      host,
      owner,
      repoName: this.parseRepoName(repoName, endsWithRepoName),
      moreSegments: endsWithRepoName ? [] : segments.slice(moreSegmentsStart),
      searchParams,
    };
  }

  // https://gitlab.com/AlexTugarev/gp-test
  protected async handleDefaultContext(
    user: User,
    host: string,
    owner: string,
    repoName: string,
  ): Promise<NavigatorContext> {
    try {
      const repository = await this.fetchRepo(user, `${owner}/${repoName}`);
      if (!repository.defaultBranch) {
        return <NavigatorContext>{
          isFile: false,
          path: '',
          title: `${owner}/${repoName}`,
          repository,
        };
      }

      try {
        const branchOrTag = await this.getBranchOrTag(user, owner, repoName, [repository.defaultBranch!]);
        return <NavigatorContext>{
          isFile: false,
          path: '',
          title: `${owner}/${repoName} - ${branchOrTag.name}`,
          ref: branchOrTag.name,
          revision: branchOrTag.revision,
          refType: branchOrTag.type,
          repository,
        };
      } catch (error) {
        if (error && error.message && (error.message as string).startsWith('Cannot find tag/branch for context')) {
          // the repo is empty (has no branches)
          return <NavigatorContext>{
            isFile: false,
            path: '',
            title: `${owner}/${repoName} - ${repository.defaultBranch}`,
            revision: '',
            repository,
          };
        } else {
          throw error;
        }
      }
    } catch (error) {
      if (UnauthorizedError.is(error)) {
        throw error;
      }
      // log.error({ userId: user.id }, error);
      throw await NotFoundError.create(await this.tokenHelper.getCurrentToken(user), user, host, owner, repoName);
    }
  }

  // https://gitlab.com/AlexTugarev/gp-test/tree/wip
  // https://gitlab.com/AlexTugarev/gp-test/tree/wip/folder
  // https://gitlab.com/AlexTugarev/gp-test/blob/wip/folder/empty.file.jpeg
  protected async handleTreeContext(
    user: User,
    host: string,
    owner: string,
    repoName: string,
    segments: string[],
  ): Promise<NavigatorContext> {
    try {
      const branchOrTagPromise = segments.length > 0 ? this.getBranchOrTag(user, owner, repoName, segments) : undefined;
      const repository = await this.fetchRepo(user, `${owner}/${repoName}`);
      const branchOrTag = await branchOrTagPromise;
      const context = <NavigatorContext>{
        isFile: false,
        path: '',
        title: `${owner}/${repoName}` + (branchOrTag ? ` - ${branchOrTag.name}` : ''),
        ref: branchOrTag && branchOrTag.name,
        revision: branchOrTag && branchOrTag.revision,
        refType: branchOrTag && branchOrTag.type,
        repository,
      };
      if (!branchOrTag) {
        return context;
      }
      if (segments.length === 1 || branchOrTag.fullPath.length === 0) {
        return context;
      }

      const result = await this.gitlabApi.run<GitLab.TreeObject[]>(user, async (g) => {
        return g.Repositories.tree(`${owner}/${repoName}`, {
          ref: branchOrTag.name,
          path: path.dirname(branchOrTag.fullPath),
        });
      });
      if (GitLab.ApiError.is(result)) {
        throw new Error(`Error reading TREE ${owner}/${repoName}/tree/${segments.join('/')}: ${result}`);
      } else {
        const object = result.find((o) => o.path === branchOrTag.fullPath);
        if (object) {
          const isFile = object.type === 'blob';
          context.isFile = isFile;
          context.path = branchOrTag.fullPath;
        }
      }
      return context;
    } catch (e) {
      log.debug('GitLab context parser: Error handle tree context.', e);
      throw e;
    }
  }

  protected async getBranchOrTag(
    user: User,
    owner: string,
    repoName: string,
    segments: string[],
  ): Promise<{ type: RefType; name: string; revision: string; fullPath: string }> {
    let branchOrTagObject: { type: RefType; name: string; revision: string } | undefined = undefined;

    // `segments` could have branch/tag name parts as well as file path parts.
    // We never know which segments belong to the branch/tag name and which are already folder names.
    // Here we generate a list of candidates for branch/tag names.
    const branchOrTagCandidates: string[] = [];
    // Try the concatination of all segments first.
    branchOrTagCandidates.push(segments.join('/'));
    // Then all subsets.
    for (let i = 1; i < segments.length; i++) {
      branchOrTagCandidates.push(segments.slice(0, i).join('/'));
    }

    for (const candidate of branchOrTagCandidates) {
      // Check if there is a BRANCH with name `candidate`:
      const possibleBranch = await this.gitlabApi.run<GitLab.Branch>(user, async (g) => {
        return g.Branches.show(`${owner}/${repoName}`, candidate);
      });
      // If the branch does not exist, the GitLab API returns with NotFound or InternalServerError.
      const isNotFoundBranch =
        GitLab.ApiError.is(possibleBranch) &&
        (GitLab.ApiError.isNotFound(possibleBranch) || GitLab.ApiError.isInternalServerError(possibleBranch));
      if (!isNotFoundBranch) {
        if (GitLab.ApiError.is(possibleBranch)) {
          throw new Error(
            `GitLab ApiError on searching for possible branches for ${owner}/${repoName}/tree/${segments.join(
              '/',
            )}: ${possibleBranch}`,
          );
        }
        branchOrTagObject = { type: 'branch', name: possibleBranch.name, revision: possibleBranch.commit.id };
        break;
      }

      // Check if there is a TAG with name `candidate`:
      const possibleTag = await this.gitlabApi.run<GitLab.Tag>(user, async (g) => {
        return g.Tags.show(`${owner}/${repoName}`, candidate);
      });
      // If the tag does not exist, the GitLab API returns with NotFound or InternalServerError.
      const isNotFoundTag =
        GitLab.ApiError.is(possibleTag) &&
        (GitLab.ApiError.isNotFound(possibleTag) || GitLab.ApiError.isInternalServerError(possibleTag));
      if (!isNotFoundTag) {
        if (GitLab.ApiError.is(possibleTag)) {
          throw new Error(
            `GitLab ApiError on searching for possible tags for ${owner}/${repoName}/tree/${segments.join(
              '/',
            )}: ${possibleTag}`,
          );
        }
        branchOrTagObject = { type: 'tag', name: possibleTag.name, revision: possibleTag.commit.id };
        break;
      }
    }

    // There seems to be no matching branch or tag.
    if (branchOrTagObject === undefined) {
      log.debug(`Cannot find tag/branch for context: ${owner}/${repoName}/tree/${segments.join('/')}.`, {
        branchOrTagCandidates,
      });
      throw new Error(`Cannot find tag/branch for context: ${owner}/${repoName}/tree/${segments.join('/')}.`);
    }

    const remainingSegmentsIndex = branchOrTagObject.name.split('/').length;
    const fullPath = decodeURIComponent(
      segments
        .slice(remainingSegmentsIndex)
        .filter((s) => s.length > 0)
        .join('/'),
    );

    return { ...branchOrTagObject, fullPath };
  }

  // https://gitlab.com/AlexTugarev/gp-test/merge_requests/1
  protected async handlePullRequestContext(
    user: User,
    host: string,
    owner: string,
    repoName: string,
    nr: number,
  ): Promise<PullRequestContext> {
    const result = await this.gitlabApi.run<GitLab.MergeRequest>(user, async (g) => {
      return g.MergeRequests.show(`${owner}/${repoName}`, nr);
    });
    if (GitLab.ApiError.is(result)) {
      throw await NotFoundError.create(await this.tokenHelper.getCurrentToken(user), user, host, owner, repoName);
    }
    const sourceProjectId = result.source_project_id;
    const targetProjectId = result.target_project_id;
    const sourceRepo = await this.fetchRepo(user, sourceProjectId);
    const tagetRepo = sourceProjectId === targetProjectId ? sourceRepo : await this.fetchRepo(user, targetProjectId);
    return <PullRequestContext>{
      title: result.title,
      repository: sourceRepo,
      ref: result.source_branch,
      refType: 'branch',
      revision: result.diff_refs.head_sha,
      nr,
      base: {
        repository: tagetRepo,
        ref: result.target_branch,
        refType: 'branch',
      },
    };
  }
  protected async fetchRepo(user: User, projectId: number | string): Promise<Repository> {
    // host might be a relative URL
    const host = this.host; // as per contract, cf. `canHandle(user, contextURL)`

    const result = await this.gitlabApi.run<GitLab.Project>(user, async (g) => {
      return g.Projects.show(projectId);
    });
    if (GitLab.ApiError.is(result)) {
      throw result;
    }
    const { path, http_url_to_repo, namespace, forked_from_project, default_branch, visibility } = result;
    const repo = <Repository>{
      host,
      name: path, // path is the last part of the URI (slug), e.g. "diaspora-project-site"
      owner: namespace.full_path,
      cloneUrl: http_url_to_repo,
      defaultBranch: default_branch,
      private: visibility === 'private',
    };
    if (forked_from_project) {
      // host might be a relative URL, let's compute the prefix
      const url = new URL(forked_from_project.http_url_to_repo.split(forked_from_project.namespace.full_path)[0]);
      const relativePath = url.pathname.slice(1); // hint: pathname always starts with `/`
      const host = relativePath ? `${url.hostname}/${relativePath}` : url.hostname;

      repo.fork = {
        parent: {
          name: forked_from_project.path,
          host,
          owner: forked_from_project.namespace.full_path,
          cloneUrl: forked_from_project.http_url_to_repo,
          defaultBranch: forked_from_project.default_branch,
        },
      };
    }
    return repo;
  }

  protected async fetchCommit(user: User, projectId: number | string, sha: string) {
    const result = await this.gitlabApi.run<GitLab.Commit>(user, async (g) => {
      return g.Commits.show(projectId, sha);
    });
    if (GitLab.ApiError.is(result)) {
      if (result.message === 'GitLab responded with code 404') {
        throw new Error(`Couldn't find commit #${sha} in repository ${projectId}.`);
      }
      throw result;
    }
    return {
      id: result.id,
      title: result.title,
    };
  }

  // https://gitlab.com/AlexTugarev/gp-test/issues/1
  protected async handleIssueContext(
    user: User,
    host: string,
    owner: string,
    repoName: string,
    nr: number,
  ): Promise<IssueContext> {
    const ctxPromise = this.handleDefaultContext(user, host, owner, repoName);
    const result = await this.gitlabApi.run<GitLab.Issue>(user, async (g) => {
      return g.Issues.show(`${owner}/${repoName}`, nr);
    });
    if (GitLab.ApiError.is(result)) {
      throw await NotFoundError.create(await this.tokenHelper.getCurrentToken(user), user, host, owner, repoName);
    }
    const context = await ctxPromise;
    return <IssueContext>{
      ...context,
      title: result.title,
      owner,
      nr,
      localBranch: IssueContexts.toBranchName(user, result.title, result.iid),
    };
  }

  // https://gitlab.com/AlexTugarev/gp-test/-/commit/80948e8cc8f0e851e89a10bc7c2ee234d1a5fbe7
  protected async handleCommitContext(
    user: User,
    host: string,
    owner: string,
    repoName: string,
    sha: string,
  ): Promise<NavigatorContext> {
    const repository = await this.fetchRepo(user, `${owner}/${repoName}`);
    if (GitLab.ApiError.is(repository)) {
      throw await NotFoundError.create(await this.tokenHelper.getCurrentToken(user), user, host, owner, repoName);
    }
    const commit = await this.fetchCommit(user, `${owner}/${repoName}`, sha);
    if (GitLab.ApiError.is(commit)) {
      throw new Error(`Couldn't find commit #${sha} in repository ${owner}/${repoName}.`);
    }
    return <NavigatorContext>{
      path: '',
      ref: '',
      refType: 'revision',
      isFile: false,
      title: `${owner}/${repoName} - ${commit.title}`,
      owner,
      revision: sha,
      repository,
    };
  }

  public async fetchCommitHistory(
    ctx: TraceContext,
    user: User,
    contextUrl: string,
    sha: string,
    maxDepth: number,
  ): Promise<string[]> {
    // TODO(janx): To get more results than GitLab API's max per_page (seems to be 100), pagination should be handled.
    const { owner, repoName } = await this.parseURL(user, contextUrl);
    const projectId = `${owner}/${repoName}`;
    const result = await this.gitlabApi.run<GitLab.Commit[]>(user, async (g) => {
      return g.Commits.all(projectId, {
        ref_name: sha,
        per_page: maxDepth,
        page: 1,
      });
    });
    if (GitLab.ApiError.is(result)) {
      if (result.message === 'GitLab responded with code 404') {
        throw new Error(`Couldn't find commit #${sha} in repository ${projectId}.`);
      }
      throw result;
    }
    return result.slice(1).map((c: GitLab.Commit) => c.id);
  }
}
