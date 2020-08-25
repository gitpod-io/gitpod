/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { KubeStage } from "@gitpod/gitpod-protocol/lib/env";

/**
 * This is the analogon to the code in ws-sync/pkg/storage/storage_gcloud.go:bucketName
 * @param userId
 * @param stage
 */
export function getBucketName(userId: string, stage: KubeStage): string {
    const bucketPrefix = getBucketNamePrefix(stage);
    return `gitpod-${bucketPrefix}-user-${userId}`;
}

/**
 * This is the analogon to the code in ws-sync/pkg/syncd/config.go:NewStorage
 * @param stage 
 */
export function getBucketNamePrefix(stage: KubeStage): string {
    switch (stage) {
        case "production":
            return "prod";
        case "staging":
            return "prodcopy";
        default:
            return "dev";
    }
}