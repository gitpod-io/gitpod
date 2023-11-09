/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Entity, Index } from "typeorm";
import {
    AdmissionConstraint,
    TLSConfig,
    WorkspaceClass,
    WorkspaceCluster,
    WorkspaceClusterState,
} from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { ValueTransformer } from "typeorm/decorator/options/ValueTransformer";

export type WorkspaceRegion = "europe" | "north-america" | "south-america" | "africa" | "asia" | ""; // unknown;

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBWorkspaceCluster implements WorkspaceCluster {
    @PrimaryColumn()
    name: string;

    @Column({
        type: "varchar",
        length: 255,
    })
    url: string;

    @Column({
        type: "simple-json",
        transformer: (() => {
            const defaultValue = {};
            const jsonifiedDefault = JSON.stringify(defaultValue);
            return <ValueTransformer>{
                // tls | undefined => <tls> | "{}"
                to(value: any): any {
                    if (!value) {
                        return jsonifiedDefault;
                    }
                    return JSON.stringify(value);
                },
                // <tls> | "{}" => tls | undefined
                from(value: any): any {
                    if (value === jsonifiedDefault) {
                        return undefined;
                    }
                    return JSON.parse(value);
                },
            };
        })(),
    })
    tls?: TLSConfig;

    @Index("ind_state")
    @Column({
        type: "char",
        length: 20,
    })
    state: WorkspaceClusterState;

    @Column()
    score: number;

    @Column()
    maxScore: number;

    @Column()
    govern: boolean;

    @Column({
        type: "simple-json",
        transformer: (() => {
            const defaultValue: AdmissionConstraint[] = [];
            const jsonifiedDefault = JSON.stringify(defaultValue);
            return <ValueTransformer>{
                to(value: any): any {
                    if (!value) {
                        return jsonifiedDefault;
                    }
                    return JSON.stringify(value);
                },
                from(value: any): any {
                    return JSON.parse(value);
                },
            };
        })(),
    })
    admissionConstraints?: AdmissionConstraint[];

    @Column({
        type: "varchar",
        length: 60,
    })
    region: WorkspaceRegion;

    // This column triggers the periodic deleter deletion mechanism. It's not intended for public consumption.
    @Column()
    deleted: boolean;

    @Column({
        type: "json",
    })
    availableWorkspaceClasses?: WorkspaceClass[];

    @Column({
        type: "varchar",
        length: 100,
        nullable: true,
    })
    preferredWorkspaceClass?: string;
}
