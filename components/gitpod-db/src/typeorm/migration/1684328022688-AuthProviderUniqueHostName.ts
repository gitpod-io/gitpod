/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class AuthProviderUniqueHostName1684328022688 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // delete any duplicates
        await queryRunner.query(`
            DELETE FROM d_b_auth_provider_entry
            WHERE id NOT IN (
                SELECT id FROM (
                    SELECT MIN(id) AS id
                    FROM d_b_auth_provider_entry
                    GROUP BY host
                ) AS t
            )
        `);
        // create constraint
        await queryRunner.query(`
            ALTER TABLE d_b_auth_provider_entry
            ADD CONSTRAINT unique_host_by_org UNIQUE (host, organizationId)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
