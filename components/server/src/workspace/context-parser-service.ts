/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceContext, User } from "@gitpod/gitpod-protocol";
import { injectable, multiInject, inject } from "inversify";
import { HostContextProvider } from "../auth/host-context-provider";
import { IPrefixContextParser, IContextParser } from "./context-parser";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";

@injectable()
export class ContextParser {
    @multiInject(IPrefixContextParser) protected readonly prefixParser: IPrefixContextParser[];
    @multiInject(IContextParser) protected readonly contextParsers: IContextParser[];
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;

    protected get allContextParsers(): IContextParser[] {
        const result = [...this.contextParsers];
        const hostContextParsers = this.hostContextProvider.getAll().filter(host => !!host.contextParser).map(host => host.contextParser!);
        result.push(...hostContextParsers);
        return result;
    }

    private normalizeContextURL(contextURL: string): string {
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

            for (const parser of this.allContextParsers) {
                if (parser.canHandle(user, contextURL)) {
                    result = await parser.handle({ span }, user, contextURL);
                    break;
                }
            }
            if (!result) {
                throw new Error(`Couldn't parse context '${contextURL}'.`);
            }

            // TODO: Make the parsers return the context with normalizedContextURL set
            result.normalizedContextURL = contextURL;

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

    protected findPrefix(user: User, context: string): { prefix: string, parser: IPrefixContextParser } | undefined {
        for (const parser of this.prefixParser) {
            const prefix = parser.findPrefix(user, context);
            if (prefix) {
                return { prefix, parser };
            }
        }
    }

}