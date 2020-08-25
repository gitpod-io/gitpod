/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';

import { NavigatorContext, User, CommitContext, Repository, PullRequestContext, IssueContext, RefType } from '@gitpod/gitpod-protocol';
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
        const span = TraceContext.startSpan("GitlabContextParser", ctx);
        span.setTag("contextUrl", contextUrl);

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
                    throw UnauthorizedError.create(this.config.host, scopes, "http-unauthorized");
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
        const segments = [owner, repoName, ...moreSegments.filter(s => s !== '-')];
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
        }
    }

    // https://gitlab.com/AlexTugarev/gp-test
    protected async handleDefaultContext(user: User, host: string, owner: string, repoName: string): Promise<NavigatorContext> {
        try {
            const repository = await this.fetchRepo(user, `${owner}/${repoName}`);
            return this.handleTreeContext(user, host, owner, repoName, repository.defaultBranch ? [ repository.defaultBranch ] : []);
        } catch (error) {
            if (UnauthorizedError.is(error)) {
                throw error;
            }
            log.error({ userId: user.id }, error);
            throw await NotFoundError.create(await this.tokenHelper.getCurrentToken(user), user, host, owner, repoName);
        }
    }

    // https://gitlab.com/AlexTugarev/gp-test/tree/wip
    // https://gitlab.com/AlexTugarev/gp-test/tree/wip/folder
    // https://gitlab.com/AlexTugarev/gp-test/blob/wip/folder/empty.file.jpeg
    protected async handleTreeContext(user: User, host: string, owner: string, repoName: string, segments: string[]): Promise<NavigatorContext> {

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
            repository
        }
        if (!branchOrTag) {
            return context;
        }
        if (segments.length === 1 || branchOrTag.fullPath.length === 0) {
            return context;
        }

        const result = await this.gitlabApi.run<GitLab.TreeObject[]>(user, async g => {
            return g.Repositories.tree(`${owner}/${repoName}`, { ref: branchOrTag.name, path: path.dirname(branchOrTag.fullPath) });
        });
        if (GitLab.ApiError.is(result)) {
            log.debug(`Error reading TREE ${owner}/${repoName}/tree/${segments.join('/')}.`, result);
        } else {
            const object = result.find(o => o.path === branchOrTag.fullPath);
            if (object) {
                const isFile = object.type === "blob";
                context.isFile = isFile;
                context.path = branchOrTag.fullPath;
            }
        }
        return context;
    }

    protected async getBranchOrTag(user: User, owner: string, repoName: string, segments: string[]): Promise<{ type: RefType, name: string, revision: string, fullPath: string }> {

        let branchOrTagObject: { type: RefType, name: string, revision: string } | undefined = undefined;

        const search = `^${segments[0]}`; // search for tags/branches that start with the first segment

        const possibleBranches = await this.gitlabApi.run<GitLab.Branch[]>(user, async g => {
            return g.Branches.all(`${owner}/${repoName}`, { search });
        });
        if (!GitLab.ApiError.is(possibleBranches)) {
            for (let candidate of possibleBranches) {
                const name = candidate.name;
                const nameSegements = candidate.name.split('/');
                if (segments.length >= nameSegements.length && segments.slice(0, nameSegements.length).join('/') === name) {
                    branchOrTagObject = { type: 'branch', name, revision: candidate.commit.id };
                    break;
                }
            }
        }

        if (branchOrTagObject === undefined) {
            const possibleTags = await this.gitlabApi.run<GitLab.Tag[]>(user, async g => {
                return g.Tags.all(`${owner}/${repoName}`, { search });
            });
            if (!GitLab.ApiError.is(possibleTags)) {
                for (let candidate of possibleTags) {
                    const name = candidate.name;
                    const nameSegements = candidate.name.split('/');
                    if (segments.length >= nameSegements.length && segments.slice(0, nameSegements.length).join('/') === name) {
                        branchOrTagObject = { type: 'tag', name, revision: candidate.commit.id };
                        break;
                    }
                }
            }
        }

        if (branchOrTagObject === undefined) {
            log.error({ userId: user.id }, `Error finding tag/branch for context: ${owner}/${repoName}/tree/${segments.join('/')}.`);
            throw new Error(`Cannot find tag/branch for context: ${owner}/${repoName}/tree/${segments.join('/')}.`);
        }

        const remainingSegmentsIndex = branchOrTagObject.name.split('/').length;
        const fullPath = decodeURIComponent(segments.slice(remainingSegmentsIndex).filter(s => s.length > 0).join('/'));

        return { ...branchOrTagObject, fullPath };
    }

    // https://gitlab.com/AlexTugarev/gp-test/merge_requests/1
    protected async handlePullRequestContext(user: User, host: string, owner: string, repoName: string, nr: number): Promise<PullRequestContext> {
        const result = await this.gitlabApi.run<GitLab.MergeRequest>(user, async g => {
            return g.MergeRequests.show(`${owner}/${repoName}`, nr);
        });
        if (GitLab.ApiError.is(result)) {
            log.error({ userId: user.id }, result);
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
            }
        };
    }
    protected async fetchRepo(user: User, projectId: number | string): Promise<Repository> {
        const result = await this.gitlabApi.run<GitLab.Project>(user, async g => {
            return g.Projects.show(projectId);
        });
        if (GitLab.ApiError.is(result)) {
            throw result;
        }
        const { path, http_url_to_repo, namespace, forked_from_project, default_branch, visibility } = result;
        const repo = <Repository>{
            host: new URL(http_url_to_repo).hostname,
            name: path, // path is the last part of the URI (slug), e.g. "diaspora-project-site"
            owner: namespace.full_path,
            cloneUrl: http_url_to_repo,
            defaultBranch: default_branch,
            private: visibility === 'private'
        }
        if (forked_from_project) {
            repo.fork = {
                parent: {
                    name: forked_from_project.path,
                    host: new URL(forked_from_project.http_url_to_repo).hostname,
                    owner: forked_from_project.namespace.full_path,
                    cloneUrl: forked_from_project.http_url_to_repo,
                    defaultBranch: forked_from_project.default_branch
                }
            }
        }
        return repo;
    }

    protected async fetchCommit(user: User, projectId: number | string, sha: string) {
        const result = await this.gitlabApi.run<GitLab.Commit>(user, async g => {
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
            title: result.title
        }
    }

    // https://gitlab.com/AlexTugarev/gp-test/issues/1
    protected async handleIssueContext(user: User, host: string, owner: string, repoName: string, nr: number): Promise<IssueContext> {
        const ctxPromise = this.handleDefaultContext(user, host, owner, repoName);
        const result = await this.gitlabApi.run<GitLab.Issue>(user, async g => {
            return g.Issues.show(`${owner}/${repoName}`, nr);
        });
        if (GitLab.ApiError.is(result)) {
            log.error({ userId: user.id }, result);
            throw await NotFoundError.create(await this.tokenHelper.getCurrentToken(user), user, host, owner, repoName);
        }
        const context = await ctxPromise;
        return <IssueContext>{
            ... context,
            title: result.title,
            owner,
            nr,
            localBranch: IssueContexts.toBranchName(user, result.title, result.iid)
        };
    }

    // https://gitlab.com/AlexTugarev/gp-test/-/commit/80948e8cc8f0e851e89a10bc7c2ee234d1a5fbe7
    protected async handleCommitContext(user: User, host: string, owner: string, repoName: string, sha: string): Promise<NavigatorContext> {
        const repository = await this.fetchRepo(user, `${owner}/${repoName}`);
        if (GitLab.ApiError.is(repository)) {
            log.error({ userId: user.id }, repository);
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
}