/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { HostContext } from "./host-context";
import { AuthProviderParams } from "./auth-provider";
import { CommitInfo, User } from "@gitpod/gitpod-protocol";
import { RepoURL } from "../repohost";

export const HostContextProvider = Symbol("HostContextProvider");

export interface HostContextProvider {
    init(): Promise<void>;
    getAll(): HostContext[];
    get(hostname: string): HostContext | undefined;
    findByAuthProviderId(authProviderId: string): HostContext | undefined;
}

export async function getCommitInfo(hostContextProvider: HostContextProvider,  user: User, repoURL: string, commitSHA: string) {
    const parsedRepo = RepoURL.parseRepoUrl(repoURL)!;
    const hostCtx = hostContextProvider.get(parsedRepo.host);
    let commitInfo: CommitInfo | undefined;
    if (hostCtx?.services?.repositoryProvider) {
        commitInfo = await hostCtx?.services?.repositoryProvider.getCommitInfo(user, parsedRepo.owner, parsedRepo.repo, commitSHA);
    }
    return commitInfo;
}

export const HostContextProviderFactory = Symbol("HostContextProviderFactory");

export interface HostContextProviderFactory {
    createHostContext: (config: AuthProviderParams) => HostContext | undefined;
}