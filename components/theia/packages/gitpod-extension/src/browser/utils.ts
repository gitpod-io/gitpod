/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { createGitpodService } from "@gitpod/gitpod-protocol";
import { GitpodService } from "@gitpod/gitpod-protocol";
import { GitpodHostUrl, workspaceIDRegex } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";

export function getGitpodService(): GitpodService {
    if (!(window as any)['_gitpodService']) {
        const serverUrl = new GitpodHostUrl(window.location.href).withoutWorkspacePrefix().toString();
        const service = createGitpodService(serverUrl);
        (window as any)['_gitpodService'] = service;
    }
    return (window as any)['_gitpodService'];
}

export function getWorkspaceID() {
    const hostSegs = window.location.host.split(".");
    if (hostSegs.length > 1 && hostSegs[0].match(workspaceIDRegex)) {
        // URL has a workspace prefix
        return hostSegs[0];
    }

    const pathSegs = window.location.pathname.split("/")
    if (pathSegs.length > 3 && pathSegs[1] === "workspace") {
        return pathSegs[2];
    }

    return "unknown-workspace-id";
}