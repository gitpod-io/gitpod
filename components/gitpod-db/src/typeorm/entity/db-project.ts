/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Entity, Column, PrimaryColumn, Index } from "typeorm";
import { TypeORM } from "../typeorm";

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBProject {
  @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
  id: string;

  @Column()
  name: string;

  @Column()
  cloneUrl: string;

  @Column(TypeORM.UUID_COLUMN_TYPE)
  @Index("ind_teamId")
  teamId: string;

  @Column()
  appInstallationId: string;

  @Column("varchar")
  creationTime: string;

  // This column triggers the db-sync deletion mechanism. It's not intended for public consumption.
  @Column()
  deleted: boolean;
}