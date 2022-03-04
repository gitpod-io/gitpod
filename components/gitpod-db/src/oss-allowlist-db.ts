/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export const OssAllowListDB = Symbol("OssAllowListDB");

export interface OssAllowListDB {
    delete(identity: string): Promise<void>;
    hasAny(identities: string[]): Promise<boolean>
}