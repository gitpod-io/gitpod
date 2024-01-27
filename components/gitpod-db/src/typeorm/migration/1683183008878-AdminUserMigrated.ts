/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { BUILTIN_INSTLLATION_ADMIN_USER_ID } from "../../user-db";

export class AdminUserMigrated1683183008878 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `UPDATE d_b_user SET additionalData = JSON_UNQUOTE(
                JSON_SET(
                    additionalData,
                    '$.isMigratedToTeamOnlyAttribution',
                    CAST('true' AS JSON)
                )) WHERE id = '${BUILTIN_INSTLLATION_ADMIN_USER_ID}'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // intentionally left blank, because we don't revert migrations
    }
}
