/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class DeleteDanglingProjectEnvVars1715064681193 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "DELETE FROM d_b_project_env_var WHERE projectId IN (SELECT id FROM d_b_project WHERE markedDeleted=true)",
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
