/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrebuiltWorkspaceState } from "./protocol";
import uuidv4 = require("uuid/v4");

export interface ProjectConfig {
    '.gitpod.yml': string;
}

export interface Project {
    id: string;
    name: string;
    cloneUrl: string;
    teamId: string;
    appInstallationId: string;
    config?: ProjectConfig;
    creationTime: string;
    /** This is a flag that triggers the HARD DELETION of this entity */
    deleted?: boolean;
}

export namespace Project {
    export const create = (project: Omit<Project, 'id' | 'creationTime'>): Project => {
        return {
            ...project,
            id: uuidv4(),
            creationTime: new Date().toISOString()
        };
    }
}

export interface ProjectInfo extends Project {
    lastPrebuild?: PrebuildInfo;
}

export interface PrebuildInfo {
    id: string;
    teamId: string;
    project: string;
    cloneUrl: string;
    branch: string;
    startedAt: string;
    startedBy: string;
    status: PrebuiltWorkspaceState;
}

export interface Team {
    id: string;
    name: string;
    slug: string;
    creationTime: string;
    /** This is a flag that triggers the HARD DELETION of this entity */
    deleted?: boolean;
}

export type TeamMemberRole = "owner" | "member";

export interface TeamMemberInfo {
    userId: string;
    fullName?: string;
    primaryEmail?: string;
    avatarUrl?: string;
    role: TeamMemberRole;
    memberSince: string;
}

export interface TeamMembershipInvite {
    id: string;
    teamId: string;
    role: TeamMemberRole;
    creationTime: string;
    invalidationTime: string;
    invitedEmail?: string;

    /** This is a flag that triggers the HARD DELETION of this entity */
    deleted?: boolean;
}