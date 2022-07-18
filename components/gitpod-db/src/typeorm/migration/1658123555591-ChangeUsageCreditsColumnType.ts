/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class New1658123371893 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`ind_stoppedAt\` ON \`d_b_workspace_instance_usage\``);
        await queryRunner.query(`DROP INDEX \`ind_startedAt\` ON \`d_b_workspace_instance_usage\``);
        await queryRunner.query(`DROP INDEX \`ind_attributionId\` ON \`d_b_workspace_instance_usage\``);
        await queryRunner.query(`DROP TABLE \`d_b_workspace_instance_usage\``);

        await queryRunner.query(
            `CREATE TABLE \`d_b_workspace_instance_usage\` (\`instanceId\` char(36) NOT NULL, \`attributionId\` varchar(255) NOT NULL, \`startedAt\` timestamp(6) NOT NULL, \`stoppedAt\` timestamp(6) NULL, \`creditsUsed\` int NOT NULL, \`generationId\` int NOT NULL, \`deleted\` tinyint NOT NULL, INDEX \`ind_attributionId\` (\`attributionId\`), INDEX \`ind_startedAt\` (\`startedAt\`), INDEX \`ind_stoppedAt\` (\`stoppedAt\`), PRIMARY KEY (\`instanceId\`)) ENGINE=InnoDB`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`ind_stoppedAt\` ON \`d_b_workspace_instance_usage\``);
        await queryRunner.query(`DROP INDEX \`ind_startedAt\` ON \`d_b_workspace_instance_usage\``);
        await queryRunner.query(`DROP INDEX \`ind_attributionId\` ON \`d_b_workspace_instance_usage\``);
        await queryRunner.query(`DROP TABLE \`d_b_workspace_instance_usage\``);
    }
}
