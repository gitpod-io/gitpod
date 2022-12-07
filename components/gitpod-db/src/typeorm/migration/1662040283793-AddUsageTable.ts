/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUsageTable1662040283793 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE \`d_b_usage\` (
                \`id\` char(36) NOT NULL,
                \`attributionId\` varchar(255) NOT NULL,
                \`description\` varchar(255) NOT NULL,
                \`creditCents\` bigint NOT NULL,
                \`effectiveTime\` varchar(255) NOT NULL,
                \`kind\` varchar(255) NOT NULL,
                \`workspaceInstanceId\` char(36) NULL,
                \`draft\` BOOLEAN NOT NULL,
                \`metadata\` text NULL,
                \`_created\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`_lastModified\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

                INDEX \`IDX_usage__attribution_id\` (\`attributionId\`),
                INDEX \`IDX_usage__effectiveTime\` (\`effectiveTime\`),
                INDEX \`IDX_usage__workspaceInstanceId\` (\`workspaceInstanceId\`),
                INDEX \`IDX_usage___lastModified\` (\`_lastModified\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_usage__attribution_id\` ON \`d_b_usage\``);
        await queryRunner.query(`DROP INDEX \`IDX_usage__effectiveTime\` ON \`d_b_usage\``);
        await queryRunner.query(`DROP INDEX \`IDX_usage__workspaceInstanceId\` ON \`d_b_usage\``);
        await queryRunner.query(`DROP INDEX \`IDX_usage___lastModified\` ON \`d_b_usage\``);
        await queryRunner.query(`DROP TABLE \`d_b_usage\``);
    }
}
