/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Branch, CommitInfo, Repository, User } from "@gitpod/gitpod-protocol";
import { HostContext } from "../auth/host-context";

export const RepositoryProvider = Symbol("RepositoryProvider");
export interface RepositoryProvider {
    getRepo(hostContext: HostContext, user: User, owner: string, repo: string): Promise<Repository>;
    getBranch(hostContext: HostContext, user: User, owner: string, repo: string, branch: string): Promise<Branch>;
    getBranches(hostContext: HostContext, user: User, owner: string, repo: string): Promise<Branch[]>;
    getCommitInfo(
        hostContext: HostContext,
        user: User,
        owner: string,
        repo: string,
        ref: string,
    ): Promise<CommitInfo | undefined>;
    getUserRepos(hostContext: HostContext, user: User): Promise<string[]>;
    hasReadAccess(hostContext: HostContext, user: User, owner: string, repo: string): Promise<boolean>;
    getCommitHistory(
        hostContext: HostContext,
        user: User,
        owner: string,
        repo: string,
        ref: string,
        maxDepth: number,
    ): Promise<string[]>;
}
