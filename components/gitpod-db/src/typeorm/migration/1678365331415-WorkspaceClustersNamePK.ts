/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class WorkspaceClustersNamePK1678365331415 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE `d_b_workspace_cluster` DROP PRIMARY KEY, ADD PRIMARY KEY (name)");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "ALTER TABLE `d_b_workspace_cluster` DROP PRIMARY KEY, ADD PRIMARY KEY (name, applicationCluster)",
        );
    }
}
