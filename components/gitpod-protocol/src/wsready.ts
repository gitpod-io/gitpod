/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// generated using github.com/32leaves/bel on 2022-11-25 13:39:08.995865257 +0000 UTC m=+0.015035221
// DO NOT MODIFY

export enum WorkspaceInitSource {
    WorkspaceInitFromBackup = "from-backup",
    WorkspaceInitFromPrebuild = "from-prebuild",
    WorkspaceInitFromOther = "from-other",
}
export interface WorkspaceReadyMessage {
    source: WorkspaceInitSource;
    metrics: InitializerMetric[];
}

export interface InitializerMetric {
    type: string;
    duration: number;
    size: number;
}
