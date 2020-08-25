/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from "typeorm";

export class WorkspaceInstanceStatus1557470736590 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        const t = await queryRunner.getTable('d_b_workspace_instance');
        if (!t) {
            throw new Error('Table d_b_workspace_instance does not exist');
        }

        await queryRunner.changeColumn(t, t.findColumnByName('status')!, <TableColumn>{
            ...t.findColumnByName('status')!,
            name: 'status_old',
            isNullable: true
        });
        await queryRunner.addColumn(t, <TableColumn>{ name: 'status', type: 'json', isNullable: false });
        await queryRunner.query(`ALTER TABLE \`${t.name}\` ADD \`phase\` CHAR(32) GENERATED ALWAYS AS (status->>"$.phase")`);

        await queryRunner.query(`
UPDATE d_b_workspace_instance wsi
SET wsi.status = CASE
    WHEN wsi.status_old = 'Starting'               THEN JSON_OBJECT('phase', 'unknown',      'conditions', JSON_OBJECT('failed', wsi.errorMessage))
    WHEN wsi.status_old = 'BuildingWorkspaceImage' THEN JSON_OBJECT('phase', 'preparing',    'conditions', JSON_OBJECT('failed', wsi.errorMessage))
    WHEN wsi.status_old = 'AcquireNode'            THEN JSON_OBJECT('phase', 'pending',      'conditions', JSON_OBJECT('failed', wsi.errorMessage))
    WHEN wsi.status_old = 'DockerPull'             THEN JSON_OBJECT('phase', 'pending',      'conditions', JSON_OBJECT('failed', wsi.errorMessage, 'pullingImages', true))
    WHEN wsi.status_old = 'WorkspaceInit'          THEN JSON_OBJECT('phase', 'initializing', 'conditions', JSON_OBJECT('failed', wsi.errorMessage))
    WHEN wsi.status_old = 'StartingIDE'            THEN JSON_OBJECT('phase', 'initializing', 'conditions', JSON_OBJECT('failed', wsi.errorMessage))
    WHEN wsi.status_old = 'Running'                THEN JSON_OBJECT('phase', 'running',      'conditions', JSON_OBJECT('failed', wsi.errorMessage))
    WHEN wsi.status_old = 'Stopping'               THEN JSON_OBJECT('phase', 'stopping',     'conditions', JSON_OBJECT('failed', wsi.errorMessage))
    WHEN wsi.status_old = 'Stopped'                THEN JSON_OBJECT('phase', 'stopped',      'conditions', JSON_OBJECT('failed', wsi.errorMessage))
    ELSE                                                JSON_OBJECT('phase', 'unknown',      'conditions', JSON_OBJECT('failed', wsi.errorMessage))
END;`);
        await queryRunner.query(`UPDATE d_b_workspace_instance SET status = JSON_REMOVE(status, '$.conditions.failed') WHERE JSON_EXTRACT(status, '$.conditions.failed') = CAST('null' AS JSON) OR JSON_EXTRACT(status, '$.conditions.failed') = ""`);

        await queryRunner.createIndex(t, new TableIndex(t.name, 'ind_instance_phase', ['phase'], false));
        await queryRunner.dropColumn(t, t.findColumnByName('errorMessage')!);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {const t = await queryRunner.getTable('d_b_workspace_instance');
        if (!t) {
            throw new Error('Table d_b_workspace_instance does not exist');
        }

        await queryRunner.query("ALTER TABLE `d_b_workspace_instance` ADD `errorMessage` text(65535) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
        await queryRunner.query("UPDATE `d_b_workspace_instance` SET `errorMessage` = (status->\"$.conditions.failed\")");

        await queryRunner.dropColumns(t, [ t.findColumnByName('phase')!, t.findColumnByName('status')! ]);
        await queryRunner.renameColumn(t.name, 'status_old', 'status');
    }

}
