/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkspaceCluster1617205663692 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS d_b_workspace_cluster (
                    name char(64) NOT NULL,
                    url varchar(255) NOT NULL,
                    tls text NOT NULL,
                    state char(20) NOT NULL,
                    score int,
                    maxScore int,
                    govern tinyint(4) NOT NULL,
                PRIMARY KEY (name),
                KEY ind_state (state))
            ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4;`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable('d_b_workspace_cluster');
    }
}
