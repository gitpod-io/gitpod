/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class LastUpdatedTime1540660412218 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_account_entry` ADD `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)");
        await queryRunner.query("ALTER TABLE `d_b_user` ADD `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)");
        await queryRunner.query("ALTER TABLE `d_b_identity` ADD `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)");
        await queryRunner.query("ALTER TABLE `d_b_subscription` ADD `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)");
        await queryRunner.query("ALTER TABLE `d_b_user_storage_resource` ADD `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)");
        await queryRunner.query("ALTER TABLE `d_b_workspace_instance` ADD `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)");
        await queryRunner.query("ALTER TABLE `d_b_workspace` ADD `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)");
        await queryRunner.query("ALTER TABLE `d_b_user_message_view_entry` ADD `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)");
        await queryRunner.query("ALTER TABLE `d_b_workspace_instance_event` ADD `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)");
        await queryRunner.query("ALTER TABLE `d_b_workspace_instance_user` ADD `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_workspace_instance_user` DROP `_lastModified`");
        await queryRunner.query("ALTER TABLE `d_b_workspace_instance_event` DROP `_lastModified`");
        await queryRunner.query("ALTER TABLE `d_b_user_message_view_entry` DROP `_lastModified`");
        await queryRunner.query("ALTER TABLE `d_b_workspace` DROP `_lastModified`");
        await queryRunner.query("ALTER TABLE `d_b_workspace_instance` DROP `_lastModified`");
        await queryRunner.query("ALTER TABLE `d_b_user_storage_resource` DROP `_lastModified`");
        await queryRunner.query("ALTER TABLE `d_b_subscription` DROP `_lastModified`");
        await queryRunner.query("ALTER TABLE `d_b_identity` DROP `_lastModified`");
        await queryRunner.query("ALTER TABLE `d_b_user` DROP `_lastModified`");
        await queryRunner.query("ALTER TABLE `d_b_account_entry` DROP `_lastModified`");
    }

}
