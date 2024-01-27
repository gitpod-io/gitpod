/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DBPersonalAccessToken } from "./typeorm/entity/db-personal-access-token";

export const PersonalAccessTokenDB = Symbol("PersonalAccessTokenDB");
export interface PersonalAccessTokenDB {
    getByHash(hash: string, expiry?: Date): Promise<DBPersonalAccessToken | undefined>;
}
