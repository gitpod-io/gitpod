/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { tableExists } from "./helper/helper";

export class FreeCredits1686907204398 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await tableExists(queryRunner, "d_b_free_credits")) {
            return;
        }

        await queryRunner.query(
            `
            CREATE TABLE d_b_free_credits (
                userId char(36) NOT NULL,
                organizationId char(36) NOT NULL,
                _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (userId)
            ) ENGINE=InnoDB
            `,
        );
        // fill with data for existing users (query takes 15 sec in production)
        await queryRunner.query(
            `
            INSERT INTO d_b_free_credits (userId, organizationId)
                SELECT distinct userId, teamId as organizationId FROM d_b_team_membership
            `,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
