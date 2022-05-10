/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// generated using github.com/32leaves/bel on 2022-05-10 18:14:25.691876738 +0000 UTC m=+0.006851101
// DO NOT MODIFY

export enum WorkspaceInitSource {
    WorkspaceInitFromBackup = "from-backup",
    WorkspaceInitFromPrebuild = "from-prebuild",
    WorkspaceInitFromOther = "from-other",
}
export interface WorkspaceReadyMessage {
    source: WorkspaceInitSource;
}
