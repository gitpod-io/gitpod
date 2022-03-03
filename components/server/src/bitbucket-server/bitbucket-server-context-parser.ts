/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { NavigatorContext, Repository, User, WorkspaceContext } from '@gitpod/gitpod-protocol';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { inject, injectable } from 'inversify';
import { NotFoundError } from '../errors';
import { AbstractContextParser, IContextParser, URLParts } from '../workspace/context-parser';
import { URL } from 'url';
import { BitbucketServer, BitbucketServerApi } from './bitbucket-server-api';
import { BitbucketServerTokenHelper } from './bitbucket-server-token-handler';

const DEFAULT_BRANCH = 'master';

@injectable()
export class BitbucketServerContextParser extends AbstractContextParser implements IContextParser {
    @inject(BitbucketServerTokenHelper) protected readonly tokenHelper: BitbucketServerTokenHelper;
    @inject(BitbucketServerApi) protected readonly api: BitbucketServerApi;

    public async handle(ctx: TraceContext, user: User, contextUrl: string): Promise<WorkspaceContext> {
        const span = TraceContext.startSpan('BitbucketServerContextParser.handle', ctx);

        try {
            const { resourceKind, host, owner, repoName /*moreSegments, searchParams*/ } = await this.parseURL(
                user,
                contextUrl,
            );

            return await this.handleNavigatorContext(ctx, user, resourceKind, host, owner, repoName);
        } catch (e) {
            span.addTags({ contextUrl }).log({ error: e });
            log.error({ userId: user.id }, 'Error parsing Bitbucket context', e);
            throw e;
        } finally {
            span.finish();
        }
    }

    public async parseURL(user: User, contextUrl: string): Promise<{ resourceKind: string } & URLParts> {
        const url = new URL(contextUrl);
        const pathname = url.pathname.replace(/^\//, '').replace(/\/$/, ''); // pathname without leading and trailing slash
        const segments = pathname.split('/');

        const host = this.host; // as per contract, cf. `canHandle(user, contextURL)`

        const lenghtOfRelativePath = host.split('/').length - 1; // e.g. "123.123.123.123/gitlab" => length of 1
        if (lenghtOfRelativePath > 0) {
            // remove segments from the path to be consider further, which belong to the relative location of the host
            // cf. https://github.com/gitpod-io/gitpod/issues/2637
            segments.splice(0, lenghtOfRelativePath);
        }

        const resourceKind = segments[0];
        const owner: string = segments[1];
        const repoName: string = segments[3];
        const moreSegmentsStart: number = 4;
        const endsWithRepoName = segments.length === moreSegmentsStart;
        const searchParams = url.searchParams;
        return {
            resourceKind,
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
        resourceKind: string,
        host: string,
        owner: string,
        repoName: string,
        more: Partial<NavigatorContext> = {},
    ): Promise<NavigatorContext> {
        const span = TraceContext.startSpan('BitbucketServerContextParser.handleNavigatorContext', ctx);
        try {
            if (resourceKind !== 'users' && resourceKind !== 'projects') {
                throw new Error('Only /users/ and /projects/ resources are supported.');
            }
            const repo = await this.api.getRepository(user, {
                kind: resourceKind,
                userOrProject: owner,
                repositorySlug: repoName,
            });
            const defaultBranch = await this.api.getDefaultBranch(user, {
                kind: resourceKind,
                userOrProject: owner,
                repositorySlug: repoName,
            });
            const repository = await this.toRepository(user, host, repo, defaultBranch);
            span.log({ 'request.finished': '' });

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
            more.refType = more.refType || 'branch';

            if (!more.revision) {
                const tipCommitOnDefaultBranch = await this.api.getCommits(user, {
                    kind: resourceKind,
                    userOrProject: owner,
                    repositorySlug: repoName,
                    q: { limit: 1 },
                });
                const commits = tipCommitOnDefaultBranch?.values || [];
                if (commits.length === 0) {
                    // empty repo
                    more.ref = undefined;
                    more.revision = '';
                    more.refType = undefined;
                } else {
                    more.revision = commits[0].id;
                    more.refType = 'revision';
                }
            }

            return {
                ...more,
                title: `${owner}/${repoName} - ${more.ref || more.revision}${more.path ? ':' + more.path : ''}`,
                repository,
            } as NavigatorContext;
        } catch (e) {
            span.log({ error: e });
            log.error({ userId: user.id }, 'Error parsing Bitbucket navigator request context', e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async toRepository(
        user: User,
        host: string,
        repo: BitbucketServer.Repository,
        defaultBranch: BitbucketServer.Branch,
    ): Promise<Repository> {
        if (!repo) {
            throw new Error('Unknown repository.');
        }

        const owner = repo.project.owner ? repo.project.owner.slug : repo.project.key;
        const name = repo.name;
        const cloneUrl = repo.links.clone.find((u) => u.name === 'http')?.href!;

        const result: Repository = {
            cloneUrl,
            host,
            name,
            owner,
            private: !repo.public,
            defaultBranch: defaultBranch.displayId || DEFAULT_BRANCH,
        };

        return result;
    }
}
