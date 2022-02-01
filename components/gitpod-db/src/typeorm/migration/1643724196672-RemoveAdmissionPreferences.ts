/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { columnExists, tableExists } from "./helper/helper";

export class RemoveAdmissionPreferences1643724196672 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await tableExists(queryRunner, "d_b_workspace_cluster")) {
            if (!(await columnExists(queryRunner, "d_b_workspace_cluster", "admissionPreferences"))) {
                await queryRunner.query("ALTER TABLE d_b_workspace_cluster DRP{} COLUMN admissionPreferences");
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
