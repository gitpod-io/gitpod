/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    OnboardingSettings,
    OrgMemberRole,
    OrganizationSettings,
    RoleRestrictions,
    TimeoutSettings,
} from "@gitpod/gitpod-protocol";
import { Entity, Column, PrimaryColumn } from "typeorm";
import { TypeORM } from "../typeorm";

@Entity()
export class DBOrgSettings implements OrganizationSettings {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    orgId: string;

    @Column({
        default: false,
    })
    workspaceSharingDisabled?: boolean;

    @Column("varchar", { nullable: true })
    defaultWorkspaceImage?: string;

    @Column("json", { nullable: true })
    allowedWorkspaceClasses?: string[];

    @Column("json", { nullable: true })
    pinnedEditorVersions?: { [key: string]: string };

    @Column("json", { nullable: true })
    restrictedEditorNames?: string[];

    @Column("varchar", { nullable: true })
    defaultRole?: OrgMemberRole;

    @Column("json", { nullable: true })
    timeoutSettings?: TimeoutSettings;

    @Column("json", { nullable: true })
    roleRestrictions?: RoleRestrictions;

    @Column({ type: "int", default: 0 })
    maxParallelRunningWorkspaces: number;

    @Column("json", { nullable: true })
    onboardingSettings?: OnboardingSettings;

    @Column({ type: "boolean", default: false })
    annotateGitCommits?: boolean;

    @Column()
    deleted: boolean;
}
