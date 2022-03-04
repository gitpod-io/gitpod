/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Entity, Column, PrimaryColumn, Index } from "typeorm";
import { TypeORM } from "../typeorm";

// should be aligned with https://github.com/gitpod-io/openvscode-server/blob/a9286bef87ed21bbf108371aa1f62d9a5bc48fc4/src/vs/platform/userDataSync/common/userDataSync.ts#L110-L160
export interface IUserData {
    ref: string;
    content: string | null;
}

export const enum SyncResource {
    Settings = 'settings',
    Keybindings = 'keybindings',
    Snippets = 'snippets',
    Tasks = 'tasks',
    Extensions = 'extensions',
    GlobalState = 'globalState',
}
export const ALL_SYNC_RESOURCES: SyncResource[] = [SyncResource.Settings, SyncResource.Keybindings, SyncResource.Snippets, SyncResource.Tasks, SyncResource.Extensions, SyncResource.GlobalState];

export interface IUserDataManifest {
	readonly latest?: Record<ServerResource, string>;
	readonly session: string;
    /**
     * This property reflects a weak ETag for caching code sync responses,
     * in the server, this is send in the Etag header and it's calculated by Express.js or we can override it manually.
     */
	//readonly ref: string;
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
