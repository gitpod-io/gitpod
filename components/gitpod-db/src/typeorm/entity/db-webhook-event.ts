/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Entity, Column, PrimaryColumn, Index } from "typeorm";

import { Transformer } from "../../typeorm/transformer";
import { WebhookEvent } from "@gitpod/gitpod-protocol";

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBWebhookEvent implements WebhookEvent {
    @PrimaryColumn("uuid")
    id: string;

    @Column()
    @Index("ind_creationTime")
    creationTime: string;

    @Column()
    type: string;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    authorizedUserId?: string;

    @Column()
    rawEvent: string;

    @Column({
        type: "varchar",
    })
    @Index("ind_status")
    status: WebhookEvent.Status;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    message?: string;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
        type: "varchar",
    })
    @Index("ind_prebuildStatus")
    prebuildStatus?: WebhookEvent.PrebuildStatus;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    @Index("ind_prebuildId")
    prebuildId?: string;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    projectId?: string;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    @Index("ind_cloneUrl")
    cloneUrl?: string;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    branch?: string;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    commit?: string;

    // This column triggers the periodic deleter deletion mechanism. It's not intended for public consumption.
    @Column()
    deleted: boolean;
}
