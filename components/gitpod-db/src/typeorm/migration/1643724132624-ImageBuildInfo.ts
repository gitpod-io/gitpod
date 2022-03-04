/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { columnExists } from "./helper/helper";

export class ImageBuildInfo1643724132624 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, "d_b_workspace_instance", "imageBuildInfo"))) {
            await queryRunner.query("ALTER TABLE d_b_workspace_instance ADD COLUMN `imageBuildInfo` text NULL");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
