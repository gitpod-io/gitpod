/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkspaceInstanceMetricsTable1739892121734 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS d_b_workspace_instance_metrics (
            instanceId char(36) NOT NULL,
            metrics JSON,
            _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
            PRIMARY KEY (instanceId),
            KEY ind_dbsync (_lastModified)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP TABLE IF EXISTS d_b_workspace_instance_metrics`);
    }
}
