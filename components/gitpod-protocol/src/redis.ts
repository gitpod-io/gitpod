/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PrebuiltWorkspaceState } from "./protocol";

export const WorkspaceInstanceUpdatesChannel = "chan:workspace-instances";
export const PrebuildUpdatesChannel = "chan:prebuilds";

export type RedisWorkspaceInstanceUpdate = {
    ownerID: string;
    instanceID: string;
    workspaceID: string;
};

export type RedisPrebuildUpdate = {
    status: PrebuiltWorkspaceState;
    prebuildID: string;
    workspaceID: string;
    projectID: string;
};
