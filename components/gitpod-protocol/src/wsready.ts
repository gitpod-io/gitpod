/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// generated using github.com/32leaves/bel on 2021-11-04 12:16:53.917570766 +0000 UTC m=+0.006002884
// DO NOT MODIFY

export enum WorkspaceInitSource {
    WorkspaceInitFromBackup = 'from-backup',
    WorkspaceInitFromPrebuild = 'from-prebuild',
    WorkspaceInitFromOther = 'from-other',
}
export interface WorkspaceReadyMessage {
    source: WorkspaceInitSource;
}
