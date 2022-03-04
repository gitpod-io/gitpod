/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { columnExists, tableExists } from "./helper/helper";

export class AdmissionPreference1633989579520 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        if (await tableExists(queryRunner, "d_b_workspace_cluster")) {
            if (!(await columnExists(queryRunner, "d_b_workspace_cluster", "admissionPreferences"))) {
                await queryRunner.query("ALTER TABLE d_b_workspace_cluster ADD COLUMN admissionPreferences TEXT");
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
    }

}
