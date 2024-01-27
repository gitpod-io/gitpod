/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { BUILTIN_INSTLLATION_ADMIN_USER_ID } from "../../user-db";

const OLD_BUILTIN_INSTLLATION_ADMIN_USER_ID = "builtin-installation-admin-user-0000";

/**
 * Because we changed IDs of the "admin-user" in this PR (https://github.com/gitpod-io/gitpod/pull/15974/files) we have to make sure we're all aligned on that new id.
 */
export class AlignAdminUsers1679391121672 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Double add it to make sure every installation has one with the new ID
        await queryRunner.query(
            `INSERT IGNORE INTO d_b_user (id, creationDate, avatarUrl, name, fullName, rolesOrPermissions, blocked) VALUES ('${BUILTIN_INSTLLATION_ADMIN_USER_ID}', '${new Date().toISOString()}', '', 'admin-user', '', '["admin"]', TRUE)`,
        );
        // Drop the old user
        await queryRunner.query(`DELETE FROM d_b_user WHERE id = '${OLD_BUILTIN_INSTLLATION_ADMIN_USER_ID}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Insert the old user again
        await queryRunner.query(
            `INSERT IGNORE INTO d_b_user (id, creationDate, avatarUrl, name, fullName, rolesOrPermissions, blocked) VALUES ('${OLD_BUILTIN_INSTLLATION_ADMIN_USER_ID}', '${new Date().toISOString()}', '', 'admin-user', '', '["admin"]', TRUE)`,
        );
    }
}
