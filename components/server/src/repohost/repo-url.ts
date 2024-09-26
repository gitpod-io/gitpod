/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { URL } from "url";
export namespace RepoURL {
    export function parseRepoUrl(
        repoUrl: string,
    ): { host: string; owner: string; repo: string; repoKind?: string } | undefined {
        const u = new URL(repoUrl);
        const host = u.host || "";
        const path = u.pathname || "";
        const segments = path.split("/").filter((s) => !!s); // e.g. [ 'gitpod-io', 'gitpod.git' ]
        if (segments.length === 2) {
            const owner = segments[0];
            const repo = segments[1].endsWith(".git") ? segments[1].slice(0, -4) : segments[1];
            return { host, owner, repo };
        }
        if (segments.length > 2) {
            const endSegment = segments[segments.length - 1];
            let ownerSegments = segments.slice(0, segments.length - 1);
            let repoKind: string | undefined;
            if (ownerSegments[0] === "scm") {
                ownerSegments = ownerSegments.slice(1);
                repoKind = "projects";
            }

            let owner = ownerSegments.join("/");
            if (owner.startsWith("~")) {
                repoKind = "users";
                owner = owner.substring(1);
            }
            // Azure DevOps
            if (owner.endsWith("/_git")) {
                owner = owner.slice(0, -5);
            }
            const repo = endSegment.endsWith(".git") ? endSegment.slice(0, -4) : endSegment;
            return { host, owner, repo, repoKind };
        }
        return undefined;
    }
}
