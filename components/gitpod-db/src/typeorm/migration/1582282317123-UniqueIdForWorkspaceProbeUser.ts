/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { BUILTIN_WORKSPACE_PROBE_USER_NAME } from "../../user-db";

export class UniqueIdForWorkspaceProbeUser1582282317123 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`UPDATE d_b_user SET id=uuid() WHERE name='${BUILTIN_WORKSPACE_PROBE_USER_NAME}'`)
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`UPDATE d_b_user SET id='builtin-user-workspace-probe-0000000' WHERE name='${BUILTIN_WORKSPACE_PROBE_USER_NAME}'`);
    }

}
