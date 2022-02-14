/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { columnExists } from "./helper/helper";

export class PrebuildUpdatableSHA1644403519382 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, "d_b_prebuilt_workspace_updatable", "commitSHA"))) {
            await queryRunner.query("ALTER TABLE d_b_prebuilt_workspace_updatable ADD COLUMN commitSHA varchar(255) NULL");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
