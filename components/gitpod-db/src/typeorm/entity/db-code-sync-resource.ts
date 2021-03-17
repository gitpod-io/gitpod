/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Entity, Column, PrimaryColumn, Index } from "typeorm";
import { TypeORM } from "../typeorm";

// should be aligned with https://github.com/gitpod-io/vscode/blob/75c71b49cc25554adc408e63b876b76dcc984bc1/src/vs/platform/userDataSync/common/userDataSync.ts#L113-L156
export interface IUserData {
    ref: string;
    content: string | null;
}

export const enum SyncResource {
    Settings = 'settings',
    Keybindings = 'keybindings',
    Snippets = 'snippets',
    Extensions = 'extensions',
    GlobalState = 'globalState'
}
export const ALL_SYNC_RESOURCES: SyncResource[] = [SyncResource.Settings, SyncResource.Keybindings, SyncResource.Snippets, SyncResource.Extensions, SyncResource.GlobalState];

export interface IUserDataManifest {
    latest: Record<ServerResource, string>
    session: string;
}

export type ServerResource = SyncResource | 'machines';
export const ALL_SERVER_RESOURCES: ServerResource[] = [...ALL_SYNC_RESOURCES, 'machines'];

@Entity()
@Index('ind_dbsync', ['created'])   // DBSync
export class DBCodeSyncResource {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    userId: string;

    @PrimaryColumn()
    kind: ServerResource;

    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    rev: string;

    @Column({
        type: 'timestamp',
        precision: 6,
        // a custom, since Transformer.MAP_ISO_STRING_TO_TIMESTAMP_DROP rounds to seconds in `from`
        transformer: {
            to(value: any): any {
                // DROP all input values as they are set by the DB 'ON UPDATE'/ as default value
                return undefined;
            },
            from(value: any): any {
                // From TIMESTAMP to ISO string
                return new Date(value).toISOString();
            }
        }
    })
    created: string;

    @Column()
    deleted: boolean;
}
