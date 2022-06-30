/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// TODO: Maybe this should be in protocol.ts?
export interface BlockedRepository {
    id: number;
    urlRegexp: string;
    blockUser: boolean;
    createdAt: string;
    updatedAt: string;
    deletedAt: string;
}
