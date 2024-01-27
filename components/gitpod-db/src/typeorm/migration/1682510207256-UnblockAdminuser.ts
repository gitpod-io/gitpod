/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { BUILTIN_INSTLLATION_ADMIN_USER_ID } from "../../user-db";

export class UnblockAdminuser1682510207256 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `UPDATE d_b_user SET blocked = FALSE WHERE id = '${BUILTIN_INSTLLATION_ADMIN_USER_ID}'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE d_b_user SET blocked = TRUE WHERE id = '${BUILTIN_INSTLLATION_ADMIN_USER_ID}'`);
    }
}
