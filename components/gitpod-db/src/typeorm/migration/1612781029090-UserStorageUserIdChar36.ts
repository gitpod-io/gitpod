import {MigrationInterface, QueryRunner} from "typeorm";

export class UserStorageUserIdChar1612781029090 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
      await queryRunner.query("ALTER TABLE d_b_user_storage_resource MODIFY userId char(36);");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
    }

}
