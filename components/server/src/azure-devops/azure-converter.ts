/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Branch, CommitInfo, Repository } from "@gitpod/gitpod-protocol";
import { GitBranchStats, GitCommitRef } from "azure-devops-node-api/interfaces/GitInterfaces";
import { GitRepository } from "azure-devops-node-api/interfaces/TfvcInterfaces";

export function toRepository(d: GitRepository): Repository {
    return {
        host: d.remoteUrl!,
        owner: d.project?.name ?? "unknown",
        name: d.name ?? "unknown",
        cloneUrl: d.remoteUrl!,
        description: d.defaultBranch,
        webUrl: d.webUrl,
        defaultBranch: d.defaultBranch,
    };
}

export function toBranch(d: GitBranchStats): Branch | undefined {
    if (!d.commit) {
        return;
    }
    const commit = toCommit(d.commit);
    if (!commit) {
        return;
    }
    return {
        htmlUrl: d.commit!.url!,
        name: d.name!,
        commit,
    };
}

export function toCommit(d: GitCommitRef): CommitInfo | undefined {
    return {
        sha: d.commitId!,
        author: d.author?.name || "unknown",
        authorAvatarUrl: "", // TODO: fetch avatar URL
        authorDate: d.author?.date?.toISOString(),
        commitMessage: d.comment || "missing commit message",
    };
}
