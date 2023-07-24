/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DBUser } from "../typeorm/entity/db-user";
import { TypeORM } from "../typeorm/typeorm";
import { isBuiltinUser } from "../user-db";

export async function resetDB(typeorm: TypeORM) {
    const conn = await typeorm.getConnection();
    const users = await conn.getRepository(DBUser).find();
    // delete all users except the builtin users
    conn.getRepository(DBUser).remove(users.filter((u) => !isBuiltinUser(u.id)));

    const deletions = conn.entityMetadatas
        .filter((meta) => meta.tableName !== "d_b_user")
        .map((meta) => {
            return conn.getRepository(meta.name).clear();
        });

    await Promise.all([
        // delete all other entities
        ...deletions,

        // we don't have a typeorm entity for this table
        conn.query("DELETE FROM d_b_oidc_client_config;"),
    ]);
}
