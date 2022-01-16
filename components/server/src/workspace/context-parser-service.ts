/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceContext, User, CommitContext, GitCheckoutInfo, PullRequestContext } from "@gitpod/gitpod-protocol";
import { injectable, multiInject, inject } from "inversify";
import { HostContextProvider } from "../auth/host-context-provider";
import { IPrefixContextParser, IContextParser } from "./context-parser";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { ConfigProvider, InvalidGitpodYMLError } from "./config-provider";

@injectable()
export class ContextParser {
    @multiInject(IPrefixContextParser) protected readonly prefixParser: IPrefixContextParser[];
    @multiInject(IContextParser) protected readonly contextParsers: IContextParser[];
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(ConfigProvider) protected readonly configProvider: ConfigProvider;

    protected get allContextParsers(): IContextParser[] {
        const result = [...this.contextParsers];
        const hostContextParsers = this.hostContextProvider.getAll().filter(host => !!host.contextParser).map(host => host.contextParser!);
        result.push(...hostContextParsers);
        return result;
    }

    public normalizeContextURL(contextURL: string): string {
        for (const parser of [...this.prefixParser, ...this.allContextParsers]) {
            const normalizedURL = parser.normalize && parser.normalize(contextURL);
            if (normalizedURL) {
                return normalizedURL;
            }
        }
        return contextURL;
    }

    public async handle(ctx: TraceContext, user: User, contextURL: string): Promise<WorkspaceContext> {
        const span = TraceContext.startSpan("ContextParser.handle", ctx);
        span.setTag("contextURL", contextURL);

        let result: WorkspaceContext | undefined;
        try {
            const prefixResult = this.findPrefix(user, contextURL);
            if (prefixResult) {
                contextURL = this.normalizeContextURL(contextURL.substring(prefixResult.prefix.length));
            }

            result = await this.internalHandleWithoutPrefix({ span }, user, contextURL);

            result = await this.handleMultiRepositoryContext({ span }, user, result);

            if (prefixResult) {
                result = await prefixResult.parser.handle(user, prefixResult.prefix, result);
            }
        } catch (e) {
            span.logEvent("error", e);
            throw e;
        } finally {
            span.finish();
        }

        return result;
    }

    protected async internalHandleWithoutPrefix(ctx: TraceContext, user: User, nonPrefixedContextURL: string): Promise<WorkspaceContext> {
        const span = TraceContext.startSpan("ContextParser.internalHandle", ctx);
        let result: WorkspaceContext | undefined;

        for (const parser of this.allContextParsers) {
            if (parser.canHandle(user, nonPrefixedContextURL)) {
                result = await parser.handle({ span }, user, nonPrefixedContextURL);
                break;
            }
        }
        if (!result) {
            throw new Error(`Couldn't parse context '${nonPrefixedContextURL}'.`);
        }

        // TODO: Make the parsers return the context with normalizedContextURL set
        result.normalizedContextURL = nonPrefixedContextURL;
        return result;
    }

    protected buildUpstreamCloneUrl(context: CommitContext): string | undefined {
        let upstreamCloneUrl: string | undefined = undefined;
        if (PullRequestContext.is(context) && context.base) {
            upstreamCloneUrl = context.base.repository.cloneUrl;
        } else if (context.repository.fork) {
            upstreamCloneUrl = context.repository.fork.parent.cloneUrl;
        }

        if (context.repository.cloneUrl === upstreamCloneUrl) {
            return undefined;
        }
        return upstreamCloneUrl;
    }

    protected async handleMultiRepositoryContext(ctx: TraceContext, user: User, context: WorkspaceContext): Promise<WorkspaceContext> {
        if (!CommitContext.is(context)) {
            return context;
        }
        const span = TraceContext.startSpan("ContextParser.handleMultiRepositoryContext", ctx);
        let config = await this.configProvider.fetchConfig({ span }, user, context);
        let mainRepoContext: WorkspaceContext | undefined;
        if (config.config.mainRepository) {
            mainRepoContext = await this.internalHandleWithoutPrefix({ span }, user, config.config.mainRepository);
            if (!CommitContext.is(mainRepoContext)) {
                throw new InvalidGitpodYMLError([`Cannot find main repository '${config.config.mainRepository}'.`]);
            }
            config = await this.configProvider.fetchConfig({ span }, user, mainRepoContext);
        }

        if (config.config.subRepositories && config.config.subRepositories.length > 0) {
            const subRepoCommits: GitCheckoutInfo[] = [];
            for (const subRepo of config.config.subRepositories) {
                let subContext = await this.internalHandleWithoutPrefix({ span }, user, subRepo.url) as CommitContext;
                if (!CommitContext.is(subContext)) {
                    throw new InvalidGitpodYMLError([`Cannot find sub-repository '${subRepo.url}'.`]);
                }
                if (context.repository.cloneUrl === subContext.repository.cloneUrl) {
                    // if it's the repo from the original context we want to use that commit.
                    subContext = JSON.parse(JSON.stringify(context));
                }

                subRepoCommits.push({
                    ... subContext,
                    checkoutLocation: (subRepo.checkoutLocation || subContext.repository.name),
                    upstreamRemoteURI: this.buildUpstreamCloneUrl(subContext),
                    localBranch: context.localBranch // we want to create a local branch on all repos, in case it's a multi-repo change. If it's not there are no drawbacks anyway.
                });
            }
            context.subRepositoryCheckoutInfo = subRepoCommits;
        }
        // if the original contexturl was pointing to a subrepo we update the commit information with the mainContext.
        if (mainRepoContext && CommitContext.is(mainRepoContext)) {
            context.repository = mainRepoContext.repository;
            context.revision = mainRepoContext.revision;
            context.ref = mainRepoContext.revision;
            context.refType = mainRepoContext.refType;
        }
        context.checkoutLocation = (config.config.checkoutLocation || context.repository.name);
        context.upstreamRemoteURI = this.buildUpstreamCloneUrl(context);
        return context;
    }

    protected findPrefix(user: User, context: string): { prefix: string, parser: IPrefixContextParser } | undefined {
        for (const parser of this.prefixParser) {
            const prefix = parser.findPrefix(user, context);
            if (prefix) {
                return { prefix, parser };
            }
        }
    }

}