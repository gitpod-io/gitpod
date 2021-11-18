/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Entity, Index } from "typeorm";
import { AdmissionConstraint, AdmissionPreference, TLSConfig, WorkspaceCluster, WorkspaceClusterState } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { ValueTransformer } from "typeorm/decorator/options/ValueTransformer";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

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
        type: "text",
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
                // also: "" | NULL => undefined (to make sure to not break on odd DB values)
                from(value: any): any {
                    if (!value || value === jsonifiedDefault) {
                        return undefined;
                    }

                    try {
                        return JSON.parse(value);
                    } catch (err) {
                        // ideally we want typeorm to skip this complete row, but can't.
                        // errors make the whole query fail: too risky here!
                        log.error("error parsing value ws-cluster from DB", err, { value });
                        return undefined;
                    }
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
        type: "text",
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
                // "[...]" | "[]" => []
                // also: "" | NULL => undefined (to make sure to not break on odd DB values)
                from(value: any): any {
                    if (!value) {
                        return undefined;
                    }

                    try {
                        return JSON.parse(value);
                    } catch (err) {
                        // ideally we want typeorm to skip this complete row, but can't.
                        // errors make the whole query fail: too risky here!
                        log.error("error parsing value ws-cluster from DB", err, { value });
                        return undefined;
                    }
                }
            };
        })()
    })
    admissionConstraints?: AdmissionConstraint[];

    @Column({
        type: "text",
        transformer: (() => {
            const defaultValue: AdmissionPreference[] = [];
            const jsonifiedDefault = JSON.stringify(defaultValue);
            return <ValueTransformer> {
                to(value: any): any {
                    if (!value) {
                        return jsonifiedDefault;
                    }
                    return JSON.stringify(value);
                },
                // "[...]" | "[]" => []
                // also: "" | NULL => undefined (to make sure to not break on odd DB values)
                from(value: any): any {
                    if (!value) {
                        return undefined;
                    }
                    try {
                        return JSON.parse(value);
                    } catch (err) {
                        // ideally we want typeorm to skip this complete row, but can't.
                        // errors make the whole query fail: too risky here!
                        log.error("error parsing value ws-cluster from DB", err, { value });
                        return undefined;
                    }
                }
            };
        })()
    })
    admissionPreferences?: AdmissionPreference[];
}