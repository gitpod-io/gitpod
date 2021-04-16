/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/// <reference types='@gitpod/gitpod-protocol/lib/typings/globals'/>

import { GitpodService } from "@gitpod/gitpod-protocol";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";

export function getGitpodService(): GitpodService {
    return window.gitpod.service;
}

const workspaceID = GitpodHostUrl.fromWorkspaceUrl(window.location.href).workspaceId || "unknown-workspace-id";
export function getWorkspaceID() {
    return workspaceID;
}