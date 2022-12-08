/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Entity, Index } from "typeorm";

import { PrebuiltWorkspaceUpdatable } from "@gitpod/gitpod-protocol";
import { TypeORM } from "../typeorm";
import { Transformer } from "../transformer";

/**
 * This index serves two query types:
 *  - INNER JOIN ON prebuiltWorkspaceId ... WHERE isResolved = ...
 *  - SELECT ... WHERE prebuiltWorkspaceId = .... (works because it's the index prefix)
 */
@Index("ind_prebuiltWorkspaceId_isResolved", ["prebuiltWorkspaceId", "isResolved"])
@Entity()
export class DBPrebuiltWorkspaceUpdatable implements PrebuiltWorkspaceUpdatable {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    @Column(TypeORM.UUID_COLUMN_TYPE)
    prebuiltWorkspaceId: string;

    @Column()
    owner: string;

    @Column()
    repo: string;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    commitSHA?: string;

    @Column()
    isResolved: boolean;

    @Column()
    installationId: string;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    contextUrl?: string;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    issue?: string;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    label?: string;

    // This column triggers the db-sync deletion mechanism. It's not intended for public consumption.
    @Column()
    deleted?: boolean;
}
