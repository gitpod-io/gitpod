/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { NavigatorContext, PullRequestContext, Repository, User, WorkspaceContext } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { inject, injectable } from "inversify";
import { NotFoundError } from "../errors";
import { AbstractContextParser, IContextParser, URLParts } from "../workspace/context-parser";
import { URL } from "url";
import { BitbucketServer, BitbucketServerApi } from "./bitbucket-server-api";
import { BitbucketServerTokenHelper } from "./bitbucket-server-token-handler";

const DEFAULT_BRANCH = "master";

@injectable()
export class BitbucketServerContextParser extends AbstractContextParser implements IContextParser {
    @inject(BitbucketServerTokenHelper) protected readonly tokenHelper: BitbucketServerTokenHelper;
    @inject(BitbucketServerApi) protected readonly api: BitbucketServerApi;

    public async handle(ctx: TraceContext, user: User, contextUrl: string): Promise<WorkspaceContext> {
        const span = TraceContext.startSpan("BitbucketServerContextParser.handle", ctx);

        try {
            const more: Partial<NavigatorContext> = {};
            const { repoKind, host, owner, repoName, moreSegments, searchParams } = await this.parseURL(
                user,
                contextUrl,
            );

            if (searchParams.has("at")) {
                const branchName = this.toSimpleBranchName(decodeURIComponent(searchParams.get("at")!));
                more.ref = branchName;
                more.refType = "branch";
            }

            if (moreSegments[0] === "pull-requests" && !!moreSegments[1]) {
                const more = { nr: parseInt(moreSegments[1]) };
                return await this.handlePullRequestContext(ctx, user, repoKind, host, owner, repoName, more);
            }

            if (moreSegments[0] === "commits" && !!moreSegments[1]) {
                more.ref = "";
                more.revision = moreSegments[1];
                more.refType = "revision";
                return await this.handleNavigatorContext(ctx, user, repoKind, host, owner, repoName, more);
            }

            return await this.handleNavigatorContext(ctx, user, repoKind, host, owner, repoName, more);
        } catch (e) {
            span.addTags({ contextUrl }).log({ error: e });
            log.error({ userId: user.id }, "Error parsing Bitbucket context", e);
            throw e;
        } finally {
            span.finish();
        }
    }

    // Example: For a given context URL https://HOST/projects/FOO/repos/repo123/browse?at=refs%2Fheads%2Ffoo
    // we need to parse the simple branch name `foo`.
    public toSimpleBranchName(qualifiedBranchName: string | undefined) {
        return qualifiedBranchName?.replace("refs/heads/", "");
    }

    public async parseURL(user: User, contextUrl: string): Promise<{ repoKind: "projects" | "users" } & URLParts> {
        const url = new URL(contextUrl);
        const pathname = url.pathname.replace(/^\//, "").replace(/\/$/, ""); // pathname without leading and trailing slash
        const segments = pathname.split("/");

        const host = this.host; // as per contract, cf. `canHandle(user, contextURL)`

        const lenghtOfRelativePath = host.split("/").length - 1; // e.g. "123.123.123.123/gitlab" => length of 1
        if (lenghtOfRelativePath > 0) {
            // remove segments from the path to be consider further, which belong to the relative location of the host
            // cf. https://github.com/gitpod-io/gitpod/issues/2637
            segments.splice(0, lenghtOfRelativePath);
        }

        let firstSegment = segments[0];
        let owner: string = segments[1];
        let repoKind: "users" | "projects";
        let repoName;
        let moreSegmentsStart;
        if (firstSegment === "scm") {
            repoKind = "projects";
            if (owner && owner.startsWith("~")) {
                repoKind = "users";
                owner = owner.substring(1);
            }
            repoName = segments[2];
            moreSegmentsStart = 3;
        } else if (firstSegment === "projects" || firstSegment === "users") {
            repoKind = firstSegment;
            repoName = segments[3];
            moreSegmentsStart = 4;
        } else {
            throw new Error("Unexpected repo kind: " + firstSegment);
        }
        const endsWithRepoName = segments.length === moreSegmentsStart;

        const searchParams = url.searchParams;
        return {
            repoKind,
            host,
            owner,
            repoName: this.parseRepoName(repoName, endsWithRepoName),
            moreSegments: endsWithRepoName ? [] : segments.slice(moreSegmentsStart),
            searchParams,
        };
    }

    public async fetchCommitHistory(
        ctx: TraceContext,
        user: User,
        contextUrl: string,
        commit: string,
        maxDepth: number,
    ): Promise<string[] | undefined> {
        return undefined;
    }

    protected async handleNavigatorContext(
        ctx: TraceContext,
        user: User,
        repoKind: "projects" | "users",
        host: string,
        owner: string,
        repoName: string,
        more: Partial<NavigatorContext> = {},
    ): Promise<NavigatorContext> {
        const span = TraceContext.startSpan("BitbucketServerContextParser.handleNavigatorContext", ctx);
        try {
            const repo = await this.api.getRepository(user, {
                repoKind,
                owner,
                repositorySlug: repoName,
            });
            const defaultBranch = await this.api.getDefaultBranch(user, {
                repoKind,
                owner,
                repositorySlug: repoName,
            });
            const repository = this.toRepository(host, repo, repoKind, defaultBranch);
            span.log({ "request.finished": "" });

            if (!repo) {
                throw await NotFoundError.create(
                    await this.tokenHelper.getCurrentToken(user),
                    user,
                    this.config.host,
                    owner,
                    repoName,
                );
            }

            if (!more.revision) {
                more.ref = more.ref || repository.defaultBranch;
            }
            more.refType = more.refType || "branch";

            if (!more.revision) {
                const tipCommitOnDefaultBranch = await this.api.getCommits(user, {
                    repoKind,
                    owner,
                    repositorySlug: repoName,
                    query: { limit: 1 },
                });
                const commits = tipCommitOnDefaultBranch?.values || [];
                if (commits.length === 0) {
                    // empty repo
                    more.ref = undefined;
                    more.revision = "";
                    more.refType = undefined;
                } else {
                    more.revision = commits[0].id;
                    // more.refType = "revision";
                }
            }

            return <NavigatorContext>{
                isFile: false,
                path: "",
                title: `${owner}/${repoName} - ${more.ref || more.revision}${more.path ? ":" + more.path : ""}`,
                ref: more.ref,
                refType: more.refType,
                revision: more.revision,
                repository,
            };
        } catch (e) {
            span.log({ error: e });
            log.error({ userId: user.id }, "Error parsing Bitbucket navigator request context", e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected toRepository(
        host: string,
        repo: BitbucketServer.Repository,
        repoKind: string,
        defaultBranch: BitbucketServer.Branch,
    ): Repository {
        const owner = repo.project.owner ? repo.project.owner.slug : repo.project.key;
        const name = repo.name;
        const cloneUrl = repo.links.clone.find((u) => u.name === "http")?.href!;
        const webUrl = repo.links?.self[0]?.href?.replace(/\/browse$/, "");

        const result: Repository = {
            webUrl,
            cloneUrl,
            host,
            name,
            owner,
            repoKind,
            private: !repo.public,
            defaultBranch: defaultBranch.displayId || DEFAULT_BRANCH,
        };

        return result;
    }

    protected async handlePullRequestContext(
        ctx: TraceContext,
        user: User,
        repoKind: "projects" | "users",
        host: string,
        owner: string,
        repoName: string,
        more: Partial<PullRequestContext> & { nr: number },
    ): Promise<PullRequestContext> {
        const pr = await this.api.getPullRequest(user, {
            repoKind,
            repositorySlug: repoName,
            owner,
            nr: more.nr,
        });

        const getRepository = async (ref: BitbucketServer.Ref) => {
            const repoKindFromRef = ref.repository.project.type === "PERSONAL" ? "users" : "projects";
            const defaultBranchFromRef = await this.api.getDefaultBranch(user, {
                repoKind: repoKindFromRef,
                owner: ref.repository.project.owner ? ref.repository.project.owner.slug : ref.repository.project.key,
                repositorySlug: ref.repository.slug,
            });
            return this.toRepository(host, ref.repository, repoKindFromRef, defaultBranchFromRef);
        };

        return <PullRequestContext>{
            repository: await getRepository(pr.fromRef),
            title: pr.title,
            ref: pr.fromRef.displayId,
            refType: "branch",
            revision: pr.fromRef.latestCommit,
            base: {
                repository: await getRepository(pr.toRef),
                ref: pr.toRef.displayId,
                refType: "branch",
            },
            ...more,
            owner,
        };
    }
}
