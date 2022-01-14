/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Entity, Column, PrimaryColumn } from "typeorm";
import { Project } from "@gitpod/gitpod-protocol";

import { TypeORM } from "../../typeorm/typeorm";

@Entity()
// on DB but not Typeorm: @Index("ind_dbsync", ["_lastModified"])   // DBSync
export class DBProjectInfo {

    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    projectId: string;

    @Column({
        type: 'simple-json',
        transformer: (() => {
            return {
                to(value: any): any {
                    return JSON.stringify(value);
                },
                from(value: any): any {
                    try {
                        const obj = JSON.parse(value);
                        if (Project.Overview.is(obj)) {
                            return obj;
                        }
                    } catch (error) {
                    }
                }
            };
        })()
    })
    overview: Project.Overview;

    // This column triggers the db-sync deletion mechanism. It's not intended for public consumption.
    @Column()
    deleted: boolean;
}