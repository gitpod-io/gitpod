/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { columnExists } from "./helper/helper";

export class DeprecateAllowsMarketingCommunication1628674695873 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        if (await columnExists(queryRunner, "d_b_user", "allowsMarketingCommunication")) {
            await queryRunner.query("UPDATE d_b_user set additionalData = JSON_MERGE_PATCH(IFNULL(additionalData, '{}'), JSON_SET('{\"emailNotificationSettings\":{\"allowsChangelogMail\":true}}', '$.emailNotificationSettings.allowsChangelogMail', IF(allowsMarketingCommunication, 'true', 'false')))");
            await queryRunner.query("ALTER TABLE d_b_user DROP COLUMN allowsMarketingCommunication");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        if (!(await columnExists(queryRunner, "d_b_user", "allowsMarketingCommunication"))) {
            await queryRunner.query("ALTER TABLE d_b_user ADD COLUMN allowsMarketingCommunication tinyint(4) NOT NULL DEFAULT '0'");
            await queryRunner.query("UPDATE d_b_user set allowsMarketingCommunication = IF(additionalData->>'$.emailNotificationSettings.allowsChangelogMail'='true', 1, 0)");
        }
    }
}
