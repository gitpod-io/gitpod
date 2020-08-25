/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { isArray } from "util";

export class InitialSetup1538732744133 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE IF NOT EXISTS d_b_account_entry (id int(11) NOT NULL PRIMARY KEY AUTO_INCREMENT, userId char(36) NOT NULL, amount double NOT NULL, date varchar(255) NOT NULL, expiryDate varchar(255) NOT NULL DEFAULT '', kind char(7) NOT NULL, description text, creditId int(11)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS d_b_user (id char(36) NOT NULL, creationDate varchar(255) NOT NULL DEFAULT '', avatarUrl varchar(255) NOT NULL DEFAULT '', name varchar(255) NOT NULL DEFAULT '', fullName varchar(255) NOT NULL DEFAULT '', allowsMarketingCommunication tinyint(4) NOT NULL DEFAULT 0, blocked tinyint(4) NOT NULL DEFAULT 0, PRIMARY KEY(id)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS d_b_identity (authProviderId varchar(255) NOT NULL, authId varchar(255) NOT NULL, authName varchar(255) NOT NULL, primaryEmail varchar(255) NOT NULL DEFAULT '', tokens text NOT NULL, userId char(36), PRIMARY KEY(authProviderId, authId)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS d_b_repository_white_list (url char(128) NOT NULL, description text NOT NULL, priority int(11) NOT NULL DEFAULT 10, PRIMARY KEY(url)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS d_b_subscription (id int(11) NOT NULL PRIMARY KEY AUTO_INCREMENT, userId char(36) NOT NULL, startDate varchar(255) NOT NULL, endDate varchar(255) NOT NULL DEFAULT '', amount double NOT NULL) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS d_b_user_message_view_entry (id int(11) NOT NULL PRIMARY KEY AUTO_INCREMENT, userId varchar(255) NOT NULL, userMessageId varchar(255) NOT NULL, viewedAt timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS d_b_user_storage_resource (id int(11) NOT NULL PRIMARY KEY AUTO_INCREMENT, userId varchar(255) NOT NULL, uri varchar(255) NOT NULL, content text NOT NULL) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS d_b_workspace_instance_event (instanceId char(36) NOT NULL, type varchar(255) NOT NULL, message varchar(255) NOT NULL DEFAULT '', creationTime timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), lastUpdatedTime timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), inProgress tinyint(4) NOT NULL DEFAULT 0, internal tinyint(4) NOT NULL DEFAULT 0, PRIMARY KEY(instanceId, type)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS d_b_workspace_instance_user (instanceId char(36) NOT NULL, userId varchar(255) NOT NULL, lastSeen timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), wasClosed tinyint(4) NOT NULL DEFAULT 0, PRIMARY KEY(instanceId, userId)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS d_b_workspace_instance (id char(36) NOT NULL, workspaceId char(36) NOT NULL, region varchar(255) NOT NULL, creationTime varchar(255) NOT NULL, startedTime varchar(255) NOT NULL DEFAULT '', deployedTime varchar(255) NOT NULL DEFAULT '', stoppedTime varchar(255) NOT NULL DEFAULT '', lastHeartbeat varchar(255) NOT NULL DEFAULT '', ideUrl varchar(255) NOT NULL, workspaceBaseImage varchar(255) NOT NULL DEFAULT '', workspaceImage varchar(255) NOT NULL, status varchar(255) NOT NULL, errorMessage varchar(255) NOT NULL DEFAULT '', PRIMARY KEY(id)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS d_b_workspace_report_entry (id int(11) NOT NULL PRIMARY KEY AUTO_INCREMENT, instanceId varchar(255) NOT NULL, data varchar(255) NOT NULL, time timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS d_b_workspace (id char(36) NOT NULL, creationTime varchar(255) NOT NULL, ownerId char(36) NOT NULL, contextURL varchar(255) NOT NULL, description varchar(255) NOT NULL, context text NOT NULL, config text NOT NULL, imageSource text, imageNameResolved varchar(255) NOT NULL DEFAULT '', workspaceImage varchar(255) NOT NULL DEFAULT '', archived tinyint(4) NOT NULL DEFAULT 0, shareable tinyint(4) NOT NULL DEFAULT 0, PRIMARY KEY(id)) ENGINE=InnoDB");

        if (!await indexExists(queryRunner, 'ind_57a78fc47596636bc71e619c12', 'd_b_workspace_instance')) {
            await queryRunner.query('CREATE INDEX ind_57a78fc47596636bc71e619c12 on d_b_workspace_instance (workspaceId)');
        }
        if (!await indexExists(queryRunner, 'ind_deb7c20cf2cce89de2b1bf882f', 'd_b_workspace')) {
            await queryRunner.query('CREATE INDEX ind_deb7c20cf2cce89de2b1bf882f on d_b_workspace (ownerId)');
        }

        if (!await indexExists(queryRunner, 'fk_4fbd6b1f34072b95d03e7ae80eb', 'd_b_identity')) {
            await queryRunner.query("ALTER TABLE d_b_identity ADD CONSTRAINT fk_4fbd6b1f34072b95d03e7ae80eb FOREIGN KEY (userId) REFERENCES d_b_user(id)");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        // this is a one-way idempotent 'migration', no rollback possible for a nonempty DB
    }

}

async function indexExists(queryRunner: QueryRunner, name: string, table: string) {
    const showIndexFromResult = await queryRunner.query(`SHOW INDEX FROM ${table} where Key_name = '${name}'`);
    if (!isArray(showIndexFromResult)) {
        throw new Error("Unexpected result of raw SQL query");
    }

    return !!showIndexFromResult.length;
}
