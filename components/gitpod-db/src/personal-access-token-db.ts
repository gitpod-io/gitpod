/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { DBPersonalAccessToken } from "./typeorm/entity/db-personal-access-token";

export const PersonalAccessTokenDB = Symbol("PersonalAccessTokenDB");
export interface PersonalAccessTokenDB {
    getByHash(hash: string, expiry?: Date): Promise<DBPersonalAccessToken | undefined>;
}
