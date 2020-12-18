/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/**
 * This is the analogon to the code in ws-daemon/pkg/syncd/config.go:NewStorage
 * @param stage 
 */
export function getBucketNamePrefix(stage: string): string {
    switch (stage) {
        case "production":
            return "prod";
        case "staging":
            return "prodcopy";
        default:
            return "dev";
    }
}