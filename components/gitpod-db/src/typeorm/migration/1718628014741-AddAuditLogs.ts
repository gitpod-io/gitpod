/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { tableExists } from "./helper/helper";

export class AddAuditLogs1718628014741 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await tableExists(queryRunner, "d_b_audit_log"))) {
            await queryRunner.query(
                `CREATE TABLE d_b_audit_log (
                    id VARCHAR(36) PRIMARY KEY NOT NULL,
                    timestamp VARCHAR(30) NOT NULL,
                    organizationId VARCHAR(36) NOT NULL,
                    actorId VARCHAR(36) NOT NULL,
                    action VARCHAR(128) NOT NULL,
                    args JSON NOT NULL
                )`,
            );
            await queryRunner.query("CREATE INDEX `ind_organizationId` ON `d_b_audit_log` (organizationId)");
            await queryRunner.query("CREATE INDEX `ind_timestamp` ON `d_b_audit_log` (timestamp)");
            await queryRunner.query("CREATE INDEX `ind_actorId` ON `d_b_audit_log` (actorId)");
            await queryRunner.query("CREATE INDEX `ind_action` ON `d_b_audit_log` (action)");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
