/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamSettings } from "@gitpod/gitpod-protocol";
import { Entity, Column, PrimaryColumn } from "typeorm";
import { TypeORM } from "../typeorm";

@Entity()
export class DBTeamSettings implements TeamSettings {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    teamId: string;

    @Column({
        default: false,
    })
    workspaceSharingDisabled?: boolean;

    @Column()
    deleted: boolean;
}
