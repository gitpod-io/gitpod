/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { ContainerModule, Container } from "inversify";

import { Token } from "@gitpod/gitpod-protocol";
import { encryptionModule } from "@gitpod/gitpod-protocol/lib/encryption/container-module";
import { KeyProviderConfig, KeyProviderImpl } from "@gitpod/gitpod-protocol/lib/encryption/key-provider";

import { Config } from "../../config";
import { TypeORM } from "../typeorm";
import { TypeORMUserDBImpl } from "../user-db-impl";
import { UserDB } from "../../user-db";

export class Tokens1551696694610 implements MigrationInterface {
    readonly containerModule = new ContainerModule((bind, unbind, isBound, rebind) => {
        bind(Config).toSelf().inSingletonScope();
        bind(TypeORM).toSelf().inSingletonScope();
        bind(TypeORMUserDBImpl).toSelf().inSingletonScope();
        bind(UserDB).toService(TypeORMUserDBImpl);

        encryptionModule(bind, unbind, isBound, rebind);
        bind(KeyProviderConfig).toDynamicValue(ctx => {
            const config = ctx.container.get<Config>(Config);
            return {
                keys: KeyProviderImpl.loadKeyConfigFromJsonString(config.dbEncryptionKeys)
            };
        }).inSingletonScope();
    });

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE `d_b_token_entry` (`authProviderId` varchar(255) NOT NULL, `authId` varchar(255) NOT NULL, `token` text NOT NULL, PRIMARY KEY(`authProviderId`, `authId`)) ENGINE=InnoDB");
        await queryRunner.query("ALTER TABLE `d_b_token_entry` ADD `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)");

        const rows = await queryRunner.query("SELECT authProviderId, authId, tokens FROM d_b_identity") as any[];
        if (rows.length > 0) {
            console.log(`d_b_token_entry: Copying ${rows.length} rows of tokens`);
            const c = new Container();
            c.load(this.containerModule);
            const userDb = c.get<UserDB>(UserDB);

            for (const row of rows) {
                try {
                    const tokens = JSON.parse(row.tokens) as Token[];
                    if (tokens.length === 0) {
                        continue;
                    }
                    const oldToken = tokens[0];
                    const token: Token = {
                        scopes: oldToken.scopes,
                        value: oldToken.value,
                        updateDate: oldToken.updateDate
                    };
                    const identity = { authProviderId: row.authProviderId, authId: row.authId };
                    await userDb.storeSingleToken(identity, token);
                } catch (err) {
                    continue;
                }
            }
            console.log(`d_b_token_entry: Done.`)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE `d_b_token_entry`");
    }

}
