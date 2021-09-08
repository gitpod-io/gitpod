/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { IssueContext, NavigatorContext, PullRequestContext, Repository, User, WorkspaceContext } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { Schema } from "bitbucket";
import { inject, injectable } from "inversify";
import { NotFoundError } from "../errors";
import { AbstractContextParser, IContextParser, IssueContexts } from "../workspace/context-parser";
import { BitbucketApiFactory } from './bitbucket-api-factory';
import { BitbucketTokenHelper } from "./bitbucket-token-handler";

const DEFAULT_BRANCH = "master";

@injectable()
export class BitbucketContextParser extends AbstractContextParser implements IContextParser {

    @inject(BitbucketTokenHelper) protected readonly tokenHelper: BitbucketTokenHelper;
    @inject(BitbucketApiFactory) protected readonly apiFactory: BitbucketApiFactory;

    private async api(user: User) {
        return this.apiFactory.create(user);
    }

    public async handle(ctx: TraceContext, user: User, contextUrl: string): Promise<WorkspaceContext> {
        const span = TraceContext.startSpan("BitbucketContextParser.handle", ctx);

        try {
            const { host, owner, repoName, moreSegments, searchParams } = await this.parseURL(user, contextUrl);
            if (moreSegments.length > 0) {
                switch (moreSegments[0]) {
                    case "src": {
                        const more: Partial<NavigatorContext> = {};
                        const branchTagOrHash = moreSegments.length > 1 ? moreSegments[1] : "";
                        const isHash = await this.isValidCommitHash(user, owner, repoName, branchTagOrHash);
                        if (isHash) {
                            more.revision = branchTagOrHash;
                            if (searchParams.has("at")) {
                                more.ref = searchParams.get("at")!;
                                more.refType = "branch";
                            }
                        } else {
                            if (await this.isTag(user, owner, repoName, branchTagOrHash)) {
                                more.ref = branchTagOrHash;
                                more.refType = "tag";
                            } else {
                                more.ref = branchTagOrHash;
                                more.refType = "branch";
                            }
                        }
                        const pathSegments = moreSegments.length > 2 ? moreSegments.slice(2) : [];
                        more.path = pathSegments.join("/");
                        return this.handleNavigatorContext(ctx, user, host, owner, repoName, more);
                    }
                    case "branch": {
                        const more: Partial<NavigatorContext> = {};
                        const pathSegments = moreSegments.length > 1 ? moreSegments.slice(1) : [];
                        more.ref = pathSegments.join("/");
                        more.refType = "branch";
                        return this.handleNavigatorContext(ctx, user, host, owner, repoName, more);
                    }
                    case "commits": {
                        const more: Partial<NavigatorContext> = {};
                        if (moreSegments.length > 1) {
                            if (moreSegments[1] === "tag") {
                                if (moreSegments.length > 2) {
                                    more.ref = moreSegments[2];
                                    more.refType = "tag";
                                }
                            } else if (moreSegments[1] === "branch") {
                                if (moreSegments.length > 2) {
                                    more.ref = moreSegments[2];
                                    more.refType = "branch";
                                }
                            } else {
                                more.ref = "";
                                more.revision = moreSegments[1];
                                more.refType = "revision";
                            }
                        }
                        return this.handleNavigatorContext(ctx, user, host, owner, repoName, more);
                    }
                    case "pull-requests": {
                        const more = { nr: parseInt(moreSegments[1]) };
                        return await this.handlePullRequestContext(ctx, user, host, owner, repoName, more);
                    }
                    case "issues": {
                        const more = { nr: parseInt(moreSegments[1]) };
                        return await this.handleIssueContext(ctx, user, host, owner, repoName, more);
                    }
                }
            }
            return await this.handleNavigatorContext(ctx, user, host, owner, repoName);
        } catch (e) {
            span.addTags({ contextUrl }).log({ error: e });
            log.error({ userId: user.id }, "Error parsing Bitbucket context", e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async isValidCommitHash(user: User, owner: string, repoName: string, potentialCommitHash: string) {
        if (potentialCommitHash.length !== 40) {
            return false;
        }
        try {
            const api = await this.api(user);
            const result = (await api.repositories.getCommit({ workspace: owner, repo_slug: repoName, node: potentialCommitHash }));
            return result.data.hash === potentialCommitHash;
        } catch {
            return false;
        }
    }

    protected async isTag(user: User, owner: string, repoName: string, potentialTag: string) {
        try {
            const api = await this.api(user);
            const result = (await api.repositories.getTag({ workspace: owner, repo_slug: repoName, name: potentialTag }));
            return result.data.name === potentialTag;
        } catch {
            return false;
        }
    }

    protected async handleNavigatorContext(ctx: TraceContext, user: User, host: string, owner: string, repoName: string, more: Partial<NavigatorContext> = {}, givenRepo?: Schema.Repository): Promise<NavigatorContext> {
        const span = TraceContext.startSpan("BitbucketContextParser.handleNavigatorContext", ctx);
        try {
            const api = await this.api(user);
            const repo = givenRepo || (await api.repositories.get({ workspace: owner, repo_slug: repoName })).data;
            const repository = await this.toRepository(user, host, repo);
            span.log({ "request.finished": "" });

            if (!repo) {
                throw await NotFoundError.create(await this.tokenHelper.getCurrentToken(user), user, this.config.host, owner, repoName);
            }

            if (!more.revision) {
                more.ref = more.ref || repository.defaultBranch;
            }
            more.refType = more.refType || "branch";

            if (!more.revision) {
                const commits = (await api.repositories.listCommitsAt({ workspace: owner, repo_slug: repoName, revision: more.ref!, pagelen: 1 })).data;
                more.revision = commits.values.length > 0 ? commits.values[0].hash : "";
                if (commits.values.length === 0 && more.ref === repository.defaultBranch) {
                    // empty repo
                    more.ref = undefined;
                    more.revision = "";
                    more.refType = undefined;
                }
            }

            if (!more.path) {
                more.isFile = false;
                more.path = "";
            } else if (more.isFile === undefined) {
                const fileMeta = (await api.repositories.readSrc({ workspace: owner, repo_slug: repoName, format: "meta", node: more.revision!, path: more.path!, pagelen: 1 })).data;
                more.isFile = (fileMeta as any).type === "commit_file";
            }

            return {
                ...more,
                title: `${owner}/${repoName} - ${more.ref || more.revision}${more.path ? ':' + more.path : ''}`,
                repository,
            } as NavigatorContext;
        } catch (e) {
            span.log({ error: e });
            log.error({ userId: user.id }, "Error parsing Bitbucket navigator request context", e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async handlePullRequestContext(ctx: TraceContext, user: User, host: string, owner: string, repoName: string, more: Partial<PullRequestContext> & { nr: number }): Promise<PullRequestContext> {
        const span = TraceContext.startSpan("BitbucketContextParser.handleIssueContext", ctx);
        try {
            const api = await this.api(user);
            const pr = (await api.repositories.getPullRequest({ workspace: owner, repo_slug: repoName, pull_request_id: more.nr })).data;
            more.title = pr.title || "";
            const source = pr.source;
            const destination = pr.destination;

            if (!source || !destination) {
                throw new Error("Bitbucket: Source or destination of PR is missing.");
            }

            const destRepo = (await api.repositories.get({ workspace: destination.repository!.full_name!.split("/")[0], repo_slug: destination.repository!.full_name!.split("/")[1] })).data
            const sourceRepo = (await api.repositories.get({ workspace: source.repository!.full_name!.split("/")[0], repo_slug: source.repository!.full_name!.split("/")[1] })).data

            return <PullRequestContext>{
                repository: await this.toRepository(user, host, sourceRepo),
                ref: source.branch!.name,
                refType: "branch",
                revision: source.commit!.hash,
                base: {
                    repository: await this.toRepository(user, host, destRepo),
                    ref: destination.branch!.name,
                    refType: "branch",
                },
                ...more,
                owner,
            };
        } catch (e) {
            span.log({ error: e });
            log.error({ userId: user.id }, "Error parsing Bitbucket pull request context", e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async handleIssueContext(ctx: TraceContext, user: User, host: string, owner: string, repoName: string, more: Partial<IssueContext> & { nr: number }): Promise<IssueContext> {
        const span = TraceContext.startSpan("BitbucketContextParser.handleIssueContext", ctx);
        try {
            const api = await this.api(user);
            const issue = (await api.repositories.getIssue({ workspace: owner, repo_slug: repoName, issue_id: `${more.nr}` })).data;
            more.title = issue.title || "";
            const navigatorContext = await this.handleNavigatorContext(ctx, user, host, owner, repoName);

            return <IssueContext>{
                ...navigatorContext,
                ...more,
                owner,
                localBranch: IssueContexts.toBranchName(user, more.title, more.nr),
            };
        } catch (e) {
            span.log({ error: e });
            log.error({ userId: user.id }, "Error parsing Bitbucket issue context", e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async toRepository(user: User, host: string, repo: Schema.Repository): Promise<Repository> {
        if (!repo) {
            throw new Error('Unknown repository.');
        }
        // full_name: string
        // The concatenation of the repository owner's username and the slugified name, e.g. "evzijst/interruptingcow". This is the same string used in Bitbucket URLs.
        const fullName = repo.full_name!.split("/");
        const owner = fullName[0];
        const name = fullName[1];

        const result: Repository = {
            cloneUrl: `https://${host}/${repo.full_name}.git`,
            // cloneUrl: repoQueryResult.links.html.href + ".git",
            // cloneUrl: repoQueryResult.links.clone.find((x: any) => x.name === "https").href,
            host,
            name,
            owner,
            private: !!repo.isPrivate,
            defaultBranch: repo.mainbranch ? repo.mainbranch.name : DEFAULT_BRANCH,
        }
        if (!!repo.parent && !!repo.parent.full_name) {
            const api = await this.api(user);
            const parentRepo = (await api.repositories.get({ workspace: repo.parent!.full_name!.split("/")[0], repo_slug: repo.parent!.full_name!.split("/")[1] })).data;
            result.fork = {
                parent: await this.toRepository(user, host, parentRepo)
            };
        }

        return result;
    }

    public async fetchCommitHistory(ctx: TraceContext, user: User, contextUrl: string, sha: string, maxDepth: number): Promise<string[]> {
        const span = TraceContext.startSpan("BitbucketContextParser.fetchCommitHistory", ctx);
        try {
            // TODO(janx): To get more results than Bitbucket API's max pagelen (seems to be 100), pagination should be handled.
            // The additional property 'page' may be helfpul.
            const api = await this.api(user);
            const { owner, repoName } = await this.parseURL(user, contextUrl);
            const result = await api.repositories.listCommitsAt({
                workspace: owner,
                repo_slug: repoName,
                revision: sha,
                pagelen: maxDepth,
            });
            return result.data.values.slice(1).map((v: Schema.Commit) => v.hash);
        } catch (e) {
            span.log({ error: e });
            log.error({ userId: user.id }, "Error fetching Bitbucket commit history", e);
            throw e;
        } finally {
            span.finish();
        }
    }
}
