/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class IndexesForDBSync1567155575945 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_account_entry`(`_lastModified`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_identity`(`_lastModified`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_subscription`(`_lastModified`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_user`(`_lastModified`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_user_message_view_entry`(`viewedAt`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_user_storage_resource`(`_lastModified`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_workspace`(`_lastModified`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_workspace_instance`(`_lastModified`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_workspace_instance_user`(`_lastModified`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_workspace_report_entry`(`time`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_snapshot`(`creationTime`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_email_domain_filter`(`_lastModified`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_prebuilt_workspace`(`_lastModified`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_app_installation`(`creationTime`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_token_entry`(`_lastModified`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_team_subscription`(`_lastModified`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_team_subscription_slot`(`_lastModified`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_edu_email_domain`(`_lastModified`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_theia_plugin`(`_lastModified`)");
        await queryRunner.query("CREATE INDEX `ind_dbsync` ON `d_b_user_env_var`(`_lastModified`)");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_account_entry` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_identity` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_subscription` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_user` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_user_message_view_entry` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_user_storage_resource` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_workspace` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_workspace_instance` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_workspace_instance_user` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_workspace_report_entry` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_snapshot` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_email_domain_filter` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_prebuilt_workspace` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_app_installation` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_token_entry` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_team_subscription` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_team_subscription_slot` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_edu_email_domain` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_theia_plugin` DROP INDEX `ind_dbsync`");
        await queryRunner.query("ALTER TABLE `d_b_user_env_var` DROP INDEX `ind_dbsync`");
    }

}
