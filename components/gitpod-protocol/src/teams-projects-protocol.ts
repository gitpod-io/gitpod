/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PrebuiltWorkspaceState, WorkspaceClasses } from "./protocol";
import { v4 as uuidv4 } from "uuid";
import { DeepPartial } from "./util/deep-partial";

export interface ProjectConfig {
    ".gitpod.yml": string;
}

export interface ProjectSettings {
    /**
     * Controls settings of prebuilds for this project.
     */
    prebuilds?: PrebuildSettings;

    // preferred workspace classes
    workspaceClasses?: WorkspaceClasses;

    /**
     * Controls workspace class restriction for this project, the list is a NOT ALLOW LIST. Empty array to allow all kind of workspace classes
     */
    restrictedWorkspaceClasses?: string[];

    restrictedEditorNames?: string[];
}
export namespace PrebuildSettings {
    export type BranchStrategy = "default-branch" | "all-branches" | "matched-branches";
}

export interface PrebuildSettings {
    enable?: boolean;

    /**
     * Defines an interval of commits to run new prebuilds for. Defaults to 20
     */
    prebuildInterval?: number;

    /**
     * Which branches to consider to run new prebuilds on. Default to "all-branches"
     */
    branchStrategy?: PrebuildSettings.BranchStrategy;
    /**
     * If `branchStrategy` s set to "matched-branches", this should define a glob-pattern to be used
     * to match the branch to run new prebuilds on. Defaults to "**"
     */
    branchMatchingPattern?: string;

    /**
     * Preferred workspace class for prebuilds.
     */
    workspaceClass?: string;
}

export interface Project {
    id: string;
    name: string;
    cloneUrl: string;
    teamId: string;
    appInstallationId: string;
    settings?: ProjectSettings;
    creationTime: string;
    markedDeleted?: boolean;
}

export namespace Project {
    export function is(data?: any): data is Project {
        return typeof data === "object" && ["id", "name", "cloneUrl", "teamId"].every((p) => p in data);
    }

    export const create = (project: Omit<Project, "id" | "creationTime">): Project => {
        return {
            ...project,
            id: uuidv4(),
            creationTime: new Date().toISOString(),
        };
    };

    export type PrebuildSettingsWithDefaults = Required<Pick<PrebuildSettings, "prebuildInterval">> & PrebuildSettings;

    export const PREBUILD_SETTINGS_DEFAULTS: PrebuildSettingsWithDefaults = {
        enable: false,
        branchMatchingPattern: "**",
        prebuildInterval: 20,
        branchStrategy: "all-branches",
    };

    /**
     * Returns effective prebuild settings for the given project. The resulting settings
     * contain default values for properties which are not set explicitly for this project.
     */
    export function getPrebuildSettings(project: Project): PrebuildSettingsWithDefaults {
        // ignoring persisted properties with `undefined` values to exclude them from the override.
        const overrides = Object.fromEntries(
            Object.entries(project.settings?.prebuilds ?? {}).filter(([_, value]) => value !== undefined),
        );

        return {
            ...PREBUILD_SETTINGS_DEFAULTS,
            ...overrides,
        };
    }

    export function hasPrebuildSettings(project: Project) {
        return !(typeof project.settings?.prebuilds === "undefined");
    }

    export interface Overview {
        branches: BranchDetails[];
        isConsideredInactive?: boolean;
    }

    export namespace Overview {
        export function is(data?: any): data is Project.Overview {
            return Array.isArray(data?.branches);
        }
    }

    export interface BranchDetails {
        name: string;
        url: string;
        isDefault: boolean;

        // Latest commit
        changeTitle: string;
        changeDate?: string;
        changeAuthor?: string;
        changeAuthorAvatar?: string;
        changePR?: string;
        changeUrl?: string;
        changeHash: string;
    }

    export type Visibility = "public" | "org-public" | "private";
}

export type PartialProject = DeepPartial<Project> & Pick<Project, "id">;

export interface ProjectUsage {
    lastWebhookReceived: string;
    lastWorkspaceStart: string;
}

export interface PrebuildWithStatus {
    info: PrebuildInfo;
    status: PrebuiltWorkspaceState;
    error?: string;
}

export interface PrebuildInfo {
    id: string;
    buildWorkspaceId: string;
    basedOnPrebuildId?: string;

    teamId?: string;
    userId?: string;

    projectId: string;
    projectName: string;

    cloneUrl: string;
    branch: string;

    startedAt: string;
    startedBy: string;
    startedByAvatar?: string;

    changeTitle: string;
    changeDate: string;
    changeAuthor: string;
    changeAuthorAvatar?: string;
    changePR?: string;
    changeUrl?: string;
    changeHash: string;
}
export namespace PrebuildInfo {
    export function is(data?: any): data is PrebuildInfo {
        return typeof data === "object" && ["id", "buildWorkspaceId", "projectId", "branch"].every((p) => p in data);
    }
}

export interface StartPrebuildResult {
    prebuildId: string;
    wsid: string;
    done: boolean;
}

// alias for backwards compatibility
export type Team = Organization;
export interface Organization {
    id: string;
    name: string;
    slug?: string;
    creationTime: string;
    markedDeleted?: boolean;
}

export interface OrganizationSettings {
    workspaceSharingDisabled?: boolean;
    // null or empty string to reset to default
    defaultWorkspaceImage?: string | null;

    // empty array to allow all kind of workspace classes
    allowedWorkspaceClasses?: string[] | null;

    pinnedEditorVersions?: { [key: string]: string } | null;

    restrictedEditorNames?: string[] | null;

    // what role new members will get, default is "member"
    defaultRole?: OrgMemberRole;
}

export type TeamMemberRole = OrgMemberRole;
export type OrgMemberRole = "owner" | "member" | "collaborator";

export namespace TeamMemberRole {
    export function isValid(role: any): role is TeamMemberRole {
        return role === "owner" || role === "member" || role === "collaborator";
    }
}

export type TeamMemberInfo = OrgMemberInfo;
export interface OrgMemberInfo {
    userId: string;
    fullName?: string;
    primaryEmail?: string;
    avatarUrl?: string;
    role: TeamMemberRole;
    memberSince: string;
    ownedByOrganization: boolean;
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
