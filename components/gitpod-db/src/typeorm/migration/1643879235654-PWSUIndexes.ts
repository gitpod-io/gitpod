/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { indexExists } from "./helper/helper";

export class PWSUIndexes1643879235654 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const TABLE_NAME = "d_b_prebuilt_workspace_updatable";
        const INDEX_NAME = "ind_prebuiltWorkspaceId_isResolved";

        if(!(await indexExists(queryRunner, TABLE_NAME, INDEX_NAME))) {
            await queryRunner.query(`CREATE INDEX ${INDEX_NAME} ON ${TABLE_NAME} (prebuiltWorkspaceId, isResolved)`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
