/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


export const UserStorageResourcesDB = Symbol('UserStorageResourcesDB');

export interface UserStorageResourcesDB {
    get(userId: string, uri: string): Promise<string>;
    update(userId: string, uri: string, content: string): Promise<void>;
    deleteAllForUser(userId: string): Promise<void>;
}
