/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkspaceInstanceUsageTable1657621928045 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE \`d_b_workspace_instance_usage\` (\`workspaceId\` char(36) NOT NULL, \`attributionId\` varchar(255) NOT NULL, \`startedAt\` timestamp(6) NOT NULL, \`stoppedAt\` timestamp(6) NULL, \`creditsUsed\` double NOT NULL, \`generationId\` int NOT NULL, \`deleted\` tinyint NOT NULL, INDEX \`IDX_1358af969a29fd9e0c6cabf37c\` (\`attributionId\`), INDEX \`IDX_25d77dfa246b93672c317e26ad\` (\`startedAt\`), INDEX \`IDX_e759ab5fcf57350da51fcf56bc\` (\`stoppedAt\`), PRIMARY KEY (\`workspaceId\`)) ENGINE=InnoDB`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_e759ab5fcf57350da51fcf56bc\` ON \`d_b_workspace_instance_usage\``);
        await queryRunner.query(`DROP INDEX \`IDX_25d77dfa246b93672c317e26ad\` ON \`d_b_workspace_instance_usage\``);
        await queryRunner.query(`DROP INDEX \`IDX_1358af969a29fd9e0c6cabf37c\` ON \`d_b_workspace_instance_usage\``);
        await queryRunner.query(`DROP TABLE \`d_b_workspace_instance_usage\``);
    }
}
