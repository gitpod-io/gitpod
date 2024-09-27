/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Branch, CommitInfo, Repository } from "@gitpod/gitpod-protocol";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { GitBranchStats, GitCommitRef } from "azure-devops-node-api/interfaces/GitInterfaces";
import { GitRepository } from "azure-devops-node-api/interfaces/TfvcInterfaces";

export function toRepository(host: string, d: GitRepository, azOrgId?: string): Repository {
    const azOrg = azOrgId ?? d.webUrl?.replace("https://dev.azure.com/", "").split("/").pop();
    const azProject = d.project?.name;
    if (!azOrg || !azProject) {
        throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Invalid repository owner");
    }
    if (!d.name) {
        throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Invalid repository name");
    }
    const owner = `${azOrg}/${azProject}`;
    const branchName = normalizeBranchName(d.defaultBranch);
    const name = d.name;
    return {
        host,
        owner,
        name,
        cloneUrl: d.webUrl!,
        description: branchName,
        webUrl: d.webUrl,
        defaultBranch: branchName,
    };
}

export function normalizeBranchName(ref: string | undefined): string {
    return ref?.replace("refs/heads/", "") ?? "main";
}

export function getOrgAndProject(orgAndProject: Repository["owner"]) {
    const parts = orgAndProject.split("/");
    if (parts.length < 2) {
        throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Invalid owner format`);
    }
    const [azOrg, azProject] = parts;
    return [azOrg, azProject] as const;
}

export function toBranch(repo: Repository, d: GitBranchStats): Branch | undefined {
    if (!d.commit) {
        return;
    }
    const commit = toCommit(d.commit);
    if (!commit) {
        return;
    }
    const url = new URL(repo.cloneUrl);
    url.searchParams.set("version", `GB${d.name}`);
    return {
        htmlUrl: url.toString(),
        name: d.name!,
        commit,
    };
}

export function toCommit(d: GitCommitRef): CommitInfo | undefined {
    return {
        sha: d.commitId!,
        author: d.author?.name || "unknown",
        authorAvatarUrl: d.author?.imageUrl ?? "",
        authorDate: d.author?.date?.toISOString(),
        commitMessage: d.comment || "missing commit message",
    };
}
