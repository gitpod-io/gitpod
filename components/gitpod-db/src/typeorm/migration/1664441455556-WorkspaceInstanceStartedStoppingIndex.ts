/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { indexExists } from "./helper/helper";

export class WorkspaceInstanceStartedStoppingIndex1662491259313 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const TABLE_NAME = "d_b_workspace_instance";

        const startedTimeIndex = "IDX_workspace_instance__started_time";
        if (!(await indexExists(queryRunner, TABLE_NAME, startedTimeIndex))) {
            await queryRunner.query(`CREATE INDEX ${startedTimeIndex} ON ${TABLE_NAME} (startedTime)`);
        }

        const stoppingTimeIndex = "IDX_workspace_instance__stopping_time";
        if (!(await indexExists(queryRunner, TABLE_NAME, stoppingTimeIndex))) {
            await queryRunner.query(`CREATE INDEX ${stoppingTimeIndex} ON ${TABLE_NAME} (stoppingTime)`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
