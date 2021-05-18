/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import {columnExists, tableExists} from "./helper/helper";

export class AlterWorkspaceInstance1621244852650 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {

        if (await tableExists(queryRunner, "d_b_workspace_instance")) {
            if (!(await columnExists(queryRunner, "d_b_workspace_instance", "clusterName")) && !(await columnExists(queryRunner, "d_b_workspace_instance", "projectName"))) {
                await queryRunner.query("ALTER TABLE `d_b_workspace_instance` ADD COLUMN projectName TEXT NOT NULL, ADD COLUMN clusterName TEXT NOT NULL");
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
    }

}
