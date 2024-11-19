/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Entity, Index } from "typeorm";

import {
    Workspace,
    WorkspaceConfig,
    WorkspaceContext,
    WorkspaceImageSource,
    WorkspaceType,
    WorkspaceSoftDeletion,
} from "@gitpod/gitpod-protocol";
import { TypeORM } from "../typeorm";
import { Transformer } from "../transformer";
import * as IndexWorkspaceIdDeleted1647333804782 from "../migration/1647333804782-IndexWorkspaceIdDeleted";

@Entity()
@Index(IndexWorkspaceIdDeleted1647333804782.TABLE_NAME, IndexWorkspaceIdDeleted1647333804782.FIELDS)
@Index("ind_contentDeletion", ["contentDeletedTime", "creationTime"])
@Index("ind_softDeletion", ["softDeletedTime", "softDeleted"])
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBWorkspace implements Workspace {
    @PrimaryColumn(TypeORM.WORKSPACE_ID_COLUMN_TYPE)
    id: string;

    @Column("varchar")
    @Index("ind_creationTime")
    creationTime: string;

    @Column({
        ...TypeORM.UUID_COLUMN_TYPE,
        transformer: Transformer.MAP_NULL_TO_UNDEFINED,
    })
    @Index()
    organizationId: string;

    @Column(TypeORM.UUID_COLUMN_TYPE)
    @Index()
    ownerId: string;

    @Column("text")
    contextURL: string;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    projectId?: string;

    @Column()
    description: string;

    @Column("simple-json")
    context: WorkspaceContext;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    cloneUrl?: string;

    @Column("simple-json")
    config: WorkspaceConfig;

    @Column("simple-json", { nullable: true })
    imageSource?: WorkspaceImageSource;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    imageNameResolved?: string;

    @Column()
    baseImageNameResolved?: string;

    @Column({
        default: false,
    })
    shareable?: boolean;

    @Index("ind_type")
    @Column({
        type: "varchar",
        default: "regular",
    })
    type: WorkspaceType;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    @Index("ind_deletionEligibilityTime")
    deletionEligibilityTime?: string;

    @Column({
        type: "varchar",
        default: "",
    })
    softDeleted?: WorkspaceSoftDeletion;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    softDeletedTime?: string;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    contentDeletedTime?: string;

    // This column triggers the periodic deleter deletion mechanism. It's not intended for public consumption.
    @Column()
    deleted?: boolean;

    @Column({
        default: false,
    })
    pinned?: boolean;

    @Column({
        ...TypeORM.UUID_COLUMN_TYPE,
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    @Index("ind_basedOnPrebuildId")
    basedOnPrebuildId?: string;

    @Column({
        ...TypeORM.UUID_COLUMN_TYPE,
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    @Index("ind_basedOnSnapshotId")
    basedOnSnapshotId?: string;
}
