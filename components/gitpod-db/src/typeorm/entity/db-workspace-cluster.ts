/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Entity, Index } from "typeorm";
import { AdmissionConstraint, TLSConfig, WorkspaceCluster, WorkspaceClusterState } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { ValueTransformer } from "typeorm/decorator/options/ValueTransformer";

@Entity()
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
            return <ValueTransformer> {
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
                }
            };
        })()
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
            return <ValueTransformer> {
                to(value: any): any {
                    if (!value) {
                        return jsonifiedDefault;
                    }
                    return JSON.stringify(value);
                },
                from(value: any): any {
                    return JSON.parse(value);
                }
            };
        })()
    })
    admissionConstraints?: AdmissionConstraint[];
}