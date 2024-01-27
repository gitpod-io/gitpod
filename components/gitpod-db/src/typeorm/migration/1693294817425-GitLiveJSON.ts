/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

export class GitLiveJSON1693294817425 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await columnExists(queryRunner, "d_b_workspace_instance", "gitStatus")) {
            await queryRunner.query(
                "ALTER TABLE d_b_workspace_instance DROP COLUMN `gitStatus`, ADD COLUMN `gitStatus` JSON",
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
