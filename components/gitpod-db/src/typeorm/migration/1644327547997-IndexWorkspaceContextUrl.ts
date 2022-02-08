/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { indexExists } from "./helper/helper";

export class IndexWorkspaceContextUrl1644327547997 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const TABLE_NAME = "d_b_workspace";
        const INDEX_NAME = "ind_contextURL";

        if(!(await indexExists(queryRunner, TABLE_NAME, INDEX_NAME))) {
            await queryRunner.query("ALTER TABLE d_b_workspace MODIFY COLUMN `contextURL` varchar(255) NOT NULL");
            await queryRunner.query(`CREATE INDEX ${INDEX_NAME} ON ${TABLE_NAME} (contextURL)`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
