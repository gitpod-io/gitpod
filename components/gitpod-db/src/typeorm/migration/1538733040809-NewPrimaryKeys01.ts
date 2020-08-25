/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

interface AffectedTable {
    name: string;
    createUID: boolean;
}

export class NewPrimaryKeys011538733040809 implements MigrationInterface {

    protected readonly affectedTables: AffectedTable[] = [
        { name: 'd_b_subscription', createUID: true },
        { name: 'd_b_user_message_view_entry', createUID: false },
        { name: 'd_b_user_storage_resource', createUID: false },
        { name: 'd_b_workspace_report_entry', createUID: true },
        { name: 'd_b_account_entry', createUID: true }
    ]

    public async up(queryRunner: QueryRunner): Promise<any> {
        await Promise.all(this.affectedTables.map(t => this.replacePrimaryKeyUp(queryRunner, t)));

        // d_b_account_entry FK creditId -> id
        await queryRunner.query("DROP TABLE IF EXISTS tmp_account_entry");
        await queryRunner.query("CREATE TEMPORARY TABLE tmp_account_entry SELECT dba00.uid as uid, dba01.uid as creditId FROM d_b_account_entry dba00 LEFT JOIN d_b_account_entry dba01 ON dba00.creditId = dba01.id");
        await queryRunner.query("ALTER TABLE d_b_account_entry DROP COLUMN creditId, ADD COLUMN creditId CHAR(36)");
        await queryRunner.query("UPDATE d_b_account_entry dba SET dba.creditId = (SELECT tmp.creditId FROM tmp_account_entry tmp WHERE tmp.uid = dba.uid LIMIT 1)");

        // introduction of the new primary key may require removal of duplicates
        await queryRunner.query("DROP TABLE IF EXISTS tmp_umve");
        await queryRunner.query("CREATE TEMPORARY TABLE tmp_umve SELECT * FROM d_b_user_message_view_entry");
        await queryRunner.query("TRUNCATE TABLE d_b_user_message_view_entry");
        await queryRunner.query("ALTER TABLE d_b_user_message_view_entry ADD PRIMARY KEY (userId, userMessageId)");
        await queryRunner.query("INSERT IGNORE INTO d_b_user_message_view_entry SELECT * FROM tmp_umve");

        await queryRunner.query("ALTER TABLE d_b_user_storage_resource ADD PRIMARY KEY (userId, uri)");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE d_b_user_message_view_entry DROP PRIMARY KEY");
        await queryRunner.query("ALTER TABLE d_b_user_storage_resource DROP PRIMARY KEY");

        // restore previous primary keys - this will fail if they're no longer unique but should fill in missing values
        await Promise.all(this.affectedTables.map(t => this.replacePrimaryKeyDown(queryRunner, t)));

        // d_b_account_entry FK creditId -> id
        await queryRunner.query("CREATE TEMPORARY TABLE tmp_account_entry SELECT dba00.id as id, dba01.id as creditId FROM d_b_account_entry dba00 LEFT JOIN d_b_account_entry dba01 ON dba00.creditId = dba01.uid");
        await queryRunner.query("ALTER TABLE d_b_account_entry DROP COLUMN creditId, ADD COLUMN creditId INT(11)");
        await queryRunner.query("UPDATE d_b_account_entry dba SET dba.creditId = (SELECT tmp.creditId FROM tmp_account_entry tmp WHERE tmp.id = dba.id LIMIT 1)");
        await queryRunner.query("DROP TABLE tmp_account_entry");

        // drop previous UID column
        await Promise.all(this.affectedTables.filter(t => t.createUID).map(t => queryRunner.query(`ALTER TABLE ${t.name} DROP COLUMN uid`)));
    }

    protected async replacePrimaryKeyUp(queryRunner: QueryRunner, table: AffectedTable): Promise<void> {
        const tbl = table.name;
        await queryRunner.query(`ALTER TABLE ${tbl} MODIFY id INT NOT NULL`);
        await queryRunner.query(`ALTER TABLE ${tbl} DROP PRIMARY KEY`);
        await queryRunner.query(`ALTER TABLE ${tbl} MODIFY id INT NULL`);
        if (table.createUID) {
            await queryRunner.query(`ALTER TABLE ${tbl} ADD COLUMN uid CHAR(36) NOT NULL`);
            await queryRunner.query(`UPDATE ${tbl} SET uid = (SELECT uuid())`);
            await queryRunner.query(`ALTER TABLE ${tbl} ADD PRIMARY KEY (uid)`);
        }
    }

    protected async replacePrimaryKeyDown(queryRunner: QueryRunner, table: AffectedTable): Promise<void> {
        const tbl = table.name;
        if (table.createUID) {
            await queryRunner.query(`ALTER TABLE ${tbl} MODIFY uid CHAR(36) NOT NULL`);
            await queryRunner.query(`ALTER TABLE ${tbl} DROP PRIMARY KEY`);
        }
        const maxId = parseInt((await queryRunner.query(`SELECT MAX(id) as nac FROM ${tbl}`) as Array<any>)[0]['nac'] || "0") + 1;
        console.log(`Setting AUTO_INCREMENT of ${tbl} to ${maxId}`);
        await queryRunner.query(`ALTER TABLE ${tbl} AUTO_INCREMENT = ${maxId}`);
        await queryRunner.query(`ALTER TABLE ${tbl} MODIFY id INT NOT NULL PRIMARY KEY AUTO_INCREMENT`);
    }

}
