/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Branch, CommitInfo, Repository } from "@gitpod/gitpod-protocol";
import { GitBranchStats, GitCommitRef } from "azure-devops-node-api/interfaces/GitInterfaces";
import { GitRepository } from "azure-devops-node-api/interfaces/TfvcInterfaces";

export function toRepository(host: string, d: GitRepository, azOrgId?: string): Repository {
    const owner = azOrgId ?? d.webUrl?.replace("https://dev.azure.com/", "").split("/").pop() ?? "unknown"; // should not be unknown
    const branchName = normalizeBranchName(d.defaultBranch);
    const name = [d.project?.name, d.name ?? "unknown"].join("/");
    return {
        host,
        owner,
        name,
        cloneUrl: d.remoteUrl!,
        description: branchName,
        webUrl: d.webUrl,
        defaultBranch: branchName,
    };
}

export function normalizeBranchName(ref: string | undefined): string {
    return ref?.replace("refs/heads/", "") ?? "main";
}

export function getProjectAndRepoName(projectAndRepo: Repository["name"]) {
    const [azProject, repoName] = projectAndRepo.split("/");
    return [azProject, repoName] as const;
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
