import {MigrationInterface, QueryRunner} from "typeorm";
import { indexExists } from "./helper/helper";

export class IndexSubscriptionTsSlotId1637586576910 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const TABLE_NAME = "d_b_subscription";
        const INDEX_NAME = "ind_teamSubscriptionSlotId";

        if (!(await indexExists(queryRunner, TABLE_NAME, INDEX_NAME))) {
            await queryRunner.query(`CREATE INDEX ${INDEX_NAME} ON ${TABLE_NAME} (teamSubscriptionSlotId)`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
