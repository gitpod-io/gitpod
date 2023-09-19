/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrganizationSettings } from "@gitpod/gitpod-protocol";
import { Entity, Column, PrimaryColumn } from "typeorm";
import { TypeORM } from "../typeorm";
import { Transformer } from "../transformer";

@Entity()
export class DBOrgSettings implements OrganizationSettings {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    orgId: string;

    @Column({
        default: false,
    })
    workspaceSharingDisabled?: boolean;

    @Column("varchar", { nullable: true, transformer: Transformer.MAP_NULL_TO_UNDEFINED })
    defaultWorkspaceImage?: string;

    @Column()
    deleted: boolean;
}
