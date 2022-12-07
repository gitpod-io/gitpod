/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

export class WorkspaceInstanceUsageAddExtraFields1658211404679 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const columns = ["userId", "workspaceId", "projectId", "workspaceType", "workspaceClass"];

        const statements = columns
            .filter(async (col) => {
                const exists = await columnExists(queryRunner, "d_b_workspace_instance_usage", col);
                return !exists;
            })
            .map((col) => {
                return `ADD COLUMN ${col} varchar(255) NOT NULL DEFAULT ''`;
            });

        if (statements.length > 0) {
            await queryRunner.query(`ALTER TABLE \`d_b_workspace_instance_usage\` ${statements.join(", ")}`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
