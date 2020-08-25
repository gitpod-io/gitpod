/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { BUILTIN_WORKSPACE_PROBE_USER_NAME } from "../../user-db";

export class WorkspaceProbeUser1567780649565 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`INSERT IGNORE INTO d_b_user (id, creationDate, avatarUrl, name, fullName) VALUES ('builtin-user-workspace-probe-0000000', '${new Date().toISOString()}', '', '${BUILTIN_WORKSPACE_PROBE_USER_NAME}', '')`)
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DELETE FROM d_b_user WHERE name = '${BUILTIN_WORKSPACE_PROBE_USER_NAME}'`);
    }

}
