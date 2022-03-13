/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';

import { Repository, PullRequestContext, NavigatorContext, IssueContext, User, CommitContext, RefType } from '@gitpod/gitpod-protocol';
import { Gitea, GiteaRestApi } from './api';
import { NotFoundError, UnauthorizedError } from '../errors';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { IContextParser, IssueContexts, AbstractContextParser } from '../workspace/context-parser';
import { GiteaScope } from './scopes';
import { GiteaTokenHelper } from './gitea-token-helper';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { convertRepo } from './convert';

const path = require('path'); // TODO(anbraten): is this really needed / correct?

@injectable()
export class GiteaContextParser extends AbstractContextParser implements IContextParser {

    @inject(GiteaRestApi) protected readonly giteaApi: GiteaRestApi;
    @inject(GiteaTokenHelper) protected readonly tokenHelper: GiteaTokenHelper;

    protected get authProviderId() {
        return this.config.id;
    }

    public async handle(ctx: TraceContext, user: User, contextUrl: string): Promise<CommitContext> {
        const span = TraceContext.startSpan("GiteaContextParser.handle", ctx);

        try {
            const { host, owner, repoName, moreSegments } = await this.parseURL(user, contextUrl);
            if (moreSegments.length > 0) {
                switch (moreSegments[0]) {
                    case 'pulls': { // https://host/owner/repo/pulls/123
                        const prNr = parseInt(moreSegments[1], 10);
                        if (isNaN(prNr))
                            break;
                        return await this.handlePullRequestContext({ span }, user, host, owner, repoName, prNr);
                    }
                    case 'src': // https://host/owner/repo/src/branch/main/path/to/folder/or/file.yml
                    case 'commits': { // https://host/owner/repo/commits/branch/main
                        return await this.handleTreeContext({ span }, user, host, owner, repoName, moreSegments.slice(1));
                    }
                    case 'releases': { // https://host/owner/repo/releases/tag/1.0.0
                        if (moreSegments.length > 1 && moreSegments[1] === "tag") {
                            return await this.handleTreeContext({ span }, user, host, owner, repoName, moreSegments.slice(2));
                        }
                        break;
                    }
                    case 'issues': { // https://host/owner/repo/issues/123
                        const issueNr = parseInt(moreSegments[1], 10);
                        if (isNaN(issueNr))
                            break;
                        return await this.handleIssueContext({ span }, user, host, owner, repoName, issueNr);
                    }
                    case 'commit': { // https://host/owner/repo/commit/cfbaea9ee7d24d95e30e0bf2d4f75e83481815bc
                        return await this.handleCommitContext({ span }, user, host, owner, repoName, moreSegments[1]);
                    }
                }
            }
            return await this.handleDefaultContext({ span }, user, host, owner, repoName);
        } catch (error) {
            if (error && error.code === 401) {
                const token = await this.tokenHelper.getCurrentToken(user);
                if (token) {
                    const scopes = token.scopes;
                    // most likely the token needs to be updated after revoking by user.
                    throw UnauthorizedError.create(this.config.host, scopes, "http-unauthorized");
                }
                // todo@alex: this is very unlikely. is coercing it into a valid case helpful?
                // here, GH API responded with a 401 code, and we are missing a token. OTOH, a missing token would not lead to a request.
                throw UnauthorizedError.create(this.config.host, GiteaScope.Requirements.PUBLIC_REPO, "missing-identity");
            }
            throw error;
        } finally {
            span.finish();
        }
    }

    protected async handleDefaultContext(ctx: TraceContext, user: User, host: string, owner: string, repoName: string): Promise<NavigatorContext> {
        try {
            const repository = await this.fetchRepo(user, owner, repoName);
            if (!repository.defaultBranch) {
                return <NavigatorContext>{
                    isFile: false,
                    path: '',
                    title: `${owner}/${repoName}`,
                    repository
                }
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
                    repository
                };
            } catch (error) {
                if (error && error.message && (error.message as string).startsWith("Cannot find tag/branch for context")) {
                    // the repo is empty (has no branches)
                    return <NavigatorContext>{
                        isFile: false,
                        path: '',
                        title: `${owner}/${repoName} - ${repository.defaultBranch}`,
                        revision: '',
                        repository
                    }
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

    protected async handleTreeContext(ctx: TraceContext, user: User, host: string, owner: string, repoName: string, segments: string[]): Promise<NavigatorContext> {

        try {
            const branchOrTagPromise = segments.length > 0 ? this.getBranchOrTag(user, owner, repoName, segments) : undefined;
            const repository = await this.fetchRepo(user, owner, repoName);
            const branchOrTag = await branchOrTagPromise;
            const context = <NavigatorContext>{
                isFile: false,
                path: '',
                title: `${owner}/${repoName}` + (branchOrTag ? ` - ${branchOrTag.name}` : ''),
                ref: branchOrTag && branchOrTag.name,
                revision: branchOrTag && branchOrTag.revision,
                refType: branchOrTag && branchOrTag.type,
                repository
            };
            if (!branchOrTag) {
                return context;
            }
            if (segments.length === 1 || branchOrTag.fullPath.length === 0) {
                return context;
            }

            const result = await this.giteaApi.run<Gitea.ContentsResponse[]>(user, async g => {
                return g.repos.repoGetContents(owner, repoName, path.dirname(branchOrTag.fullPath), { ref: branchOrTag.name });
            });
            if (Gitea.ApiError.is(result)) {
                throw new Error(`Error reading TREE ${owner}/${repoName}/tree/${segments.join('/')}: ${result}`);
            } else {
                const object = result.find(o => o.path === branchOrTag.fullPath);
                if (object) {
                    const isFile = object.type === "blob";
                    context.isFile = isFile;
                    context.path = branchOrTag.fullPath;
                }
            }
            return context;
        } catch (e) {
            log.debug("Gitea context parser: Error handle tree context.", e);
            throw e;
        }
    }

    protected async getBranchOrTag(user: User, owner: string, repoName: string, segments: string[]): Promise<{ type: RefType, name: string, revision: string, fullPath: string }> {

        let branchOrTagObject: { type: RefType, name: string, revision: string } | undefined = undefined;

        // `segments` could have branch/tag name parts as well as file path parts.
        // We never know which segments belong to the branch/tag name and which are already folder names.
        // Here we generate a list of candidates for branch/tag names.
        const branchOrTagCandidates: string[] = [];
        // Try the concatination of all segments first.
        branchOrTagCandidates.push(segments.join("/"));
        // Then all subsets.
        for (let i = 1; i < segments.length; i++) {
            branchOrTagCandidates.push(segments.slice(0, i).join("/"));
        }

        for (const candidate of branchOrTagCandidates) {

            // Check if there is a BRANCH with name `candidate`:
            const possibleBranch = await this.giteaApi.run<Gitea.Branch>(user, async g => {
                return g.repos.repoGetBranch(owner, repoName, candidate);
            });
            // If the branch does not exist, the Gitea API returns with NotFound or InternalServerError.
            const isNotFoundBranch = Gitea.ApiError.is(possibleBranch) && (Gitea.ApiError.isNotFound(possibleBranch) || Gitea.ApiError.isInternalServerError(possibleBranch));
            if (!isNotFoundBranch) {
                if (Gitea.ApiError.is(possibleBranch)) {
                    throw new Error(`Gitea ApiError on searching for possible branches for ${owner}/${repoName}/tree/${segments.join('/')}: ${possibleBranch}`);
                }

                if (!possibleBranch.commit?.id || !possibleBranch.name) {
                    throw new Error(`Gitea ApiError on searching for possible branches for ${owner}/${repoName}/tree/${segments.join('/')}: ${possibleBranch}`);
                }

                branchOrTagObject = { type: 'branch', name: possibleBranch.name, revision: possibleBranch.commit.id };
                break;
            }

            // Check if there is a TAG with name `candidate`:
            const possibleTag = await this.giteaApi.run<Gitea.Tag>(user, async g => {
                return g.repos.repoGetTag(owner, repoName, candidate);
            });
            // TODO
            // If the tag does not exist, the GitLab API returns with NotFound or InternalServerError.
            const isNotFoundTag = Gitea.ApiError.is(possibleTag) && (Gitea.ApiError.isNotFound(possibleTag) || Gitea.ApiError.isInternalServerError(possibleTag));
            if (!isNotFoundTag) {
                if (Gitea.ApiError.is(possibleTag)) {
                    throw new Error(`Gitea ApiError on searching for possible tags for ${owner}/${repoName}/tree/${segments.join('/')}: ${possibleTag}`);
                }

                if (!possibleTag.commit?.sha || !possibleTag.name) {
                    throw new Error(`Gitea ApiError on searching for possible branches for ${owner}/${repoName}/tree/${segments.join('/')}: ${possibleBranch}`);
                }

                branchOrTagObject = { type: 'tag', name: possibleTag.name, revision: possibleTag.commit.sha };
                break;
            }
        }

        // There seems to be no matching branch or tag.
        if (branchOrTagObject === undefined) {
            log.debug(`Cannot find tag/branch for context: ${owner}/${repoName}/tree/${segments.join('/')}.`,
                { branchOrTagCandidates }
            );
            throw new Error(`Cannot find tag/branch for context: ${owner}/${repoName}/tree/${segments.join('/')}.`);
        }

        const remainingSegmentsIndex = branchOrTagObject.name.split('/').length;
        const fullPath = decodeURIComponent(segments.slice(remainingSegmentsIndex).filter(s => s.length > 0).join('/'));

        return { ...branchOrTagObject, fullPath };
    }

    protected async handlePullRequestContext(ctx: TraceContext, user: User, host: string, owner: string, repoName: string, nr: number): Promise<PullRequestContext> {
        const result = await this.giteaApi.run<Gitea.PullRequest>(user, async g => {
            return g.repos.repoGetPullRequest(owner, repoName, nr);
        });
        if (Gitea.ApiError.is(result)) {
            throw await NotFoundError.create(await this.tokenHelper.getCurrentToken(user), user, host, owner, repoName);
        }

        if (!result.base?.repo || !result.head?.repo || !result.title) {
            throw new Error(`Missing relevant commit information for pull-request ${nr} from repository ${owner}/${repoName}`);
        }

        const sourceRepo = convertRepo(result.head?.repo);
        const targetRepo = convertRepo(result.base?.repo);

        return <PullRequestContext>{
            title: result.title,
            repository: sourceRepo,
            ref: result.head.ref,
            refType: 'branch',
            revision: result.head.sha,
            nr,
            base: {
                repository: targetRepo,
                ref: result.base.ref,
                refType: 'branch',
            }
        };
    }

    protected async fetchRepo(user: User, owner: string, repoName: string): Promise<Repository> {
        // host might be a relative URL
        const host = this.host; // as per contract, cf. `canHandle(user, contextURL)`

        const result = await this.giteaApi.run<Gitea.Repository>(user, async g => {
            return g.repos.repoGet(owner, repoName);
        });
        if (Gitea.ApiError.is(result)) {
            throw result;
        }
        const repo = <Repository>{
            host,
            name: repoName,
            owner: owner,
            cloneUrl: result.clone_url,
            defaultBranch: result.default_branch,
            private: result.private
        }
        // TODO: support forks
        //  if (result.fork) {
        //      // host might be a relative URL, let's compute the prefix
        //      const url = new URL(forked_from_project.http_url_to_repo.split(forked_from_project.namespace.full_path)[0]);
        //      const relativePath = url.pathname.slice(1); // hint: pathname always starts with `/`
        //      const host = relativePath ? `${url.hostname}/${relativePath}` : url.hostname;

        //      repo.fork = {
        //          parent: {
        //              name: forked_from_project.path,
        //              host,
        //              owner: forked_from_project.namespace.full_path,
        //              cloneUrl: forked_from_project.http_url_to_repo,
        //              defaultBranch: forked_from_project.default_branch
        //          }
        //      }
        //  }
        return repo;
    }

    protected async fetchCommit(user: User, owner: string, repoName: string, sha: string) {
        const result = await this.giteaApi.run<Gitea.Commit>(user, async g => {
            return g.repos.repoGetSingleCommit(owner, repoName, sha);
        });
        if (Gitea.ApiError.is(result)) {
            if (result.message === 'Gitea responded with code 404') {
                throw new Error(`Couldn't find commit #${sha} in repository ${owner}/${repoName}.`);
            }
            throw result;
        }

        if (!result.sha || !result.commit?.message) {
            throw new Error(`The commit does not have all needed data ${owner}/${repoName}.`);
        }

        return {
            id: result.sha, // TODO: how can we use a proper commit-id instead of the sha
            title: result.commit?.message
        }
    }

    protected async handleIssueContext(ctx: TraceContext, user: User, host: string, owner: string, repoName: string, nr: number): Promise<IssueContext> {
        const ctxPromise = this.handleDefaultContext(ctx, user, host, owner, repoName);
        const result = await this.giteaApi.run<Gitea.Issue>(user, async g => {
            return g.repos.issueGetIssue(owner, repoName, nr);
        });
        if (Gitea.ApiError.is(result) || !result.title || !result.id) {
            throw await NotFoundError.create(await this.tokenHelper.getCurrentToken(user), user, host, owner, repoName);
        }
        const context = await ctxPromise;
        return <IssueContext>{
            ...context,
            title: result.title,
            owner,
            nr,
            localBranch: IssueContexts.toBranchName(user, result.title, result.id)
        };
    }

    protected async handleCommitContext(ctx: TraceContext, user: User, host: string, owner: string, repoName: string, sha: string): Promise<NavigatorContext> {
        const repository = await this.fetchRepo(user, owner, repoName);
        if (Gitea.ApiError.is(repository)) {
            throw await NotFoundError.create(await this.tokenHelper.getCurrentToken(user), user, host, owner, repoName);
        }
        const commit = await this.fetchCommit(user, owner, repoName, sha);
        if (Gitea.ApiError.is(commit)) {
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

    public async fetchCommitHistory(ctx: TraceContext, user: User, contextUrl: string, sha: string, maxDepth: number): Promise<string[]> {
        const span = TraceContext.startSpan("GiteaContextParser.fetchCommitHistory", ctx);

        try {
            if (sha.length != 40) {
                throw new Error(`Invalid commit ID ${sha}.`);
            }

            // TODO(janx): To get more results than Gitea API's max page size (seems to be 100), pagination should be handled.
            // These additional history properties may be helfpul:
            //     totalCount,
            //     pageInfo {
            //         haxNextPage,
            //     },
            const { owner, repoName } = await this.parseURL(user, contextUrl);
            const result = await this.giteaApi.run<Gitea.Commit[]>(user, async g => {
                return g.repos.repoGetAllCommits(owner, repoName, {
                    sha,
                    limit: maxDepth,
                    page: 1,
                });
            });
            if (Gitea.ApiError.is(result)) {
                if (result.message === 'Gitea responded with code 404') {
                    throw new Error(`Couldn't find commit #${sha} in repository ${owner}/${repoName}.`);
                }
                throw result;
            }

            return result.slice(1).map((c) => {
                // TODO: how can we use a proper commit-id instead of the sha
                if (!c.sha) {
                    throw new Error(`Commit #${sha} does not have commit.`);
                }

                return c.sha;
            });
        } catch (e) {
            span.log({ "error": e });
            throw e;
        } finally {
            span.finish();
        }
    }
}
