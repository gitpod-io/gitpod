/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Entity, Column, PrimaryColumn, Index } from "typeorm";
import { TypeORM } from "../typeorm";
import { ProjectConfig } from "@gitpod/gitpod-protocol";
import { Transformer } from "../transformer";

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBProject {
  @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
  id: string;

  @Column()
  name: string;

  @Column()
  slug?: string;

  @Column()
  cloneUrl: string;

  @Column({
    default: '',
    transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED
  })
  @Index("ind_teamId")
  teamId?: string;

  @Column({
    default: '',
    transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED
  })
  @Index("ind_userId")
  userId?: string;

  @Column()
  appInstallationId: string;

  @Column("simple-json", { nullable: true })
  config?: ProjectConfig;

  @Column("varchar")
  creationTime: string;

  // This column triggers the db-sync deletion mechanism. It's not intended for public consumption.
  @Column()
  deleted: boolean;

  @Column()
  markedDeleted: boolean;
}