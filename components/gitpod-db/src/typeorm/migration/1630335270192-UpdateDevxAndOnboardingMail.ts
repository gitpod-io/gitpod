/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { columnExists } from "./helper/helper";

export class UpdateDevxAndOnboardingMail1630335270192 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        if (await columnExists(queryRunner, "d_b_user", "additionalData")) {
            await queryRunner.query("UPDATE d_b_user set additionalData = json_set(additionalData, '$.emailNotificationSettings.allowsDevXMail', true) WHERE (json_extract(additionalData, '$.emailNotificationSettings.allowsChangelogMail')=true OR json_extract(additionalData, '$.emailNotificationSettings.allowsChangelogMail')='true') AND json_extract(additionalData, '$.emailNotificationSettings.allowsDevXMail') IS NULL")
            await queryRunner.query("UPDATE d_b_user set additionalData = json_set(additionalData, '$.emailNotificationSettings.allowsOnboardingMail', true) WHERE json_extract(additionalData, '$.emailNotificationSettings.allowsOnboardingMail') IS NULL")
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
    }

}
