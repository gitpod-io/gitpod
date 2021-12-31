/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { CommitContext, User, WorkspaceConfig } from "@gitpod/gitpod-protocol";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { inject, injectable } from "inversify";
import { HostContextProvider } from "../auth/host-context-provider";
import { FileProvider } from "../repohost";
import { ContextParser } from "../workspace/context-parser-service";
import { ConfigInferrer } from "./config-inferrer";


@injectable()
export class ConfigurationService {

    @inject(ContextParser) protected contextParser: ContextParser;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;

    // a static cache used to prefetch inferrer related files in parallel in advance
    private requestedPaths = new Set<string>();

    async guessRepositoryConfiguration(ctx: TraceContext, user: User, contextURLOrContext: string | CommitContext): Promise<string | undefined> {
        const { fileProvider, commitContext } = await this.getRepositoryFileProviderAndCommitContext(ctx, user, contextURLOrContext);
        const cache: { [path: string]: Promise<string | undefined> } = {};
        const readFile = async (path: string) => {
            if (path in cache) {
                return await cache[path];
            }
            this.requestedPaths.add(path);
            const content = fileProvider.getFileContent(commitContext, user, path);
            cache[path] = content;
            return await content;
        }
        // eagerly fetch for all files that the inferrer usually asks for.
        this.requestedPaths.forEach(path => !(path in cache) && readFile(path));
        const config: WorkspaceConfig = await new ConfigInferrer().getConfig({
            config: {},
            read: readFile,
            exists: async (path: string) => !!(await readFile(path)),
        });
        if (!config.tasks) {
            return;
        }
        const configString = `tasks:\n  - ${config.tasks.map(task => Object.entries(task).map(([phase, command]) => `${phase}: ${command}`).join('\n    ')).join('\n  - ')}`;
        return configString;
    }

    async fetchRepositoryConfiguration(ctx: TraceContext, user: User, contextURL: string): Promise<string | undefined> {
        const { fileProvider, commitContext } = await this.getRepositoryFileProviderAndCommitContext(ctx, user, contextURL);
        const configString = await fileProvider.getGitpodFileContent(commitContext, user);
        return configString;
    }


    protected async getRepositoryFileProviderAndCommitContext(ctx: TraceContext, user: User, contextURLOrContext: string | CommitContext): Promise<{fileProvider: FileProvider, commitContext: CommitContext}> {
        let commitContext: CommitContext;
        if (typeof contextURLOrContext === 'string') {
            const normalizedContextUrl = this.contextParser.normalizeContextURL(contextURLOrContext);
            commitContext = (await this.contextParser.handle(ctx, user, normalizedContextUrl)) as CommitContext;
        } else {
            commitContext = contextURLOrContext;
        }
        const { host } = commitContext.repository;
        const hostContext = this.hostContextProvider.get(host);
        if (!hostContext || !hostContext.services) {
            throw new Error(`Cannot fetch repository configuration for host: ${host}`);
        }
        const fileProvider = hostContext.services.fileProvider;
        return { fileProvider, commitContext };
    }
}