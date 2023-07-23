/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DBUser, TypeORM, isBuiltinUser } from "@gitpod/gitpod-db/lib";
import { DBProject } from "@gitpod/gitpod-db/lib/typeorm/entity/db-project";
import { DBTeam } from "@gitpod/gitpod-db/lib/typeorm/entity/db-team";
import { DBTeamMembership } from "@gitpod/gitpod-db/lib/typeorm/entity/db-team-membership";

export async function resetDB(typeorm: TypeORM) {
    const conn = await typeorm.getConnection();
    await conn.getRepository(DBTeam).clear();
    await conn.getRepository(DBTeamMembership).clear();
    await conn.getRepository(DBProject).clear();
    // delete all users except the builtin users
    const users = await conn.getRepository(DBUser).find();
    await conn.getRepository(DBUser).remove(users.filter((u) => !isBuiltinUser(u.id)));
}
