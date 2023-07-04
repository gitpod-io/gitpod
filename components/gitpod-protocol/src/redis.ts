/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export const WorkspaceInstanceUpdatesChannel = "chan:workspace-instances";

export type RedisWorkspaceInstanceUpdate = {
    instanceID: string;
    workspaceID: string;
};
