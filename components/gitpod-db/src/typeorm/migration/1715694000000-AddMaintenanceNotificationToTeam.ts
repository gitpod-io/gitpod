/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMaintenanceNotificationToTeam1715694000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE `d_b_team` ADD COLUMN `maintenanceNotification` json NULL");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE `d_b_team` DROP COLUMN `maintenanceNotification`");
    }
}
