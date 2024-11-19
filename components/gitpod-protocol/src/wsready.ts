/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// generated using github.com/32leaves/bel on 2024-09-10 10:27:59.702679509 +0000 UTC m=+0.029900569
// DO NOT MODIFY

export interface WorkspaceReadyMessage {
    source: WorkspaceInitSource;
    metrics: InitializerMetric[];
}

export enum WorkspaceInitSource {
    WorkspaceInitFromBackup = "from-backup",
    WorkspaceInitFromPrebuild = "from-prebuild",
    WorkspaceInitFromOther = "from-other",
}
export interface InitializerMetric {
    type: string;
    duration: number;
    size: number;
}
