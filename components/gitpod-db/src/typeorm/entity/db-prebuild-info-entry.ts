/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Entity, Column, PrimaryColumn } from "typeorm";
import { PrebuildInfo } from "@gitpod/gitpod-protocol";

import { TypeORM } from "../../typeorm/typeorm";

@Entity()
export class DBPrebuildInfo {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    prebuildId: string;

    @Column({
        type: "simple-json",
        transformer: (() => {
            return {
                to(value: any): any {
                    return JSON.stringify(value);
                },
                from(value: any): any {
                    try {
                        const obj = JSON.parse(value);
                        return PrebuildInfo.is(obj) ? obj : undefined;
                    } catch (error) {}
                },
            };
        })(),
    })
    info: PrebuildInfo;

    // This column triggers the periodic deleter deletion mechanism. It's not intended for public consumption.
    @Column()
    deleted?: boolean;
}
