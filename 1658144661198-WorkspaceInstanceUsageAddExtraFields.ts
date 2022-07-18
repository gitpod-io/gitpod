import {MigrationInterface, QueryRunner} from "typeorm";
import {columnExists} from "@gitpod/gitpod-db/lib/typeorm/migration/helper/helper";

export class WorkspaceInstanceUsageAddExtraFields1658144661198 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {

        const columns = ['userId', 'workspaceId', 'projectId', 'workspaceType', 'workspaceClass'];

        const statements = columns
            .filter(async col => {
                const exists = await columnExists(queryRunner, "d_b_workspace_instance_usage", col)
                return !exists;
            })
            .map(col => {
                return `ADD COLUMN ${col} varchar(255) NOT NULL DEFAULT ''`;
            });

        if (statements.length > 0) {
            await queryRunner.query(`ALTER TABLE \`d_b_workspace_instance_usage\` ${statements.join(", ")}`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}

}
