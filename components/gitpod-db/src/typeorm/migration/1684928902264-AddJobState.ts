/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddJobState1684928902264 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // create table d_b_job_state
        await queryRunner.query(
            "CREATE TABLE `d_b_job_state` (`jobId` varchar(255) NOT NULL, `lastUpdated` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), `state` json NULL, PRIMARY KEY (`jobId`)) ENGINE=InnoDB",
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
