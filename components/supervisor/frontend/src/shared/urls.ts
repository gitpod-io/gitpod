/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";

export const workspaceUrl = GitpodHostUrl.fromWorkspaceUrl(window.location.href);

export const serverUrl = workspaceUrl.withoutWorkspacePrefix();

export const startUrl = workspaceUrl.asStart();
