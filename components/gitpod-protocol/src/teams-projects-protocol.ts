/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PrebuiltWorkspaceState, WorkspaceClasses } from "./protocol";
import { v4 as uuidv4 } from "uuid";
import { DeepPartial } from "./util/deep-partial";
import { WebhookEvent } from "./webhook-event";

export interface ProjectConfig {
    ".gitpod.yml": string;
}

export interface ProjectSettings {
    enablePrebuilds?: boolean;
    /**
     * Wether prebuilds (if enabled) should only be started on the default branch.
     * Defaults to `true` on project creation.
     */
    prebuildDefaultBranchOnly?: boolean;
    /**
     * Use this pattern to match branch names to run prebuilds on.
     * The pattern matching will only be applied if prebuilds are enabled and
     * they are not limited to the default branch.
     */
    prebuildBranchPattern?: string;
    useIncrementalPrebuilds?: boolean;
    keepOutdatedPrebuildsRunning?: boolean;
    // whether new workspaces can start on older prebuilds and incrementally update
    allowUsingPreviousPrebuilds?: boolean;
    // how many commits in the commit history a prebuild is good (undefined and 0 means every commit is prebuilt)
    prebuildEveryNthCommit?: number;
    // preferred workspace classes
    workspaceClasses?: WorkspaceClasses;
}
export namespace ProjectSettings {
    export type PrebuildBranchStrategy = "defaultBranch" | "allBranches" | "selectedBranches";
}

export interface Project {
    id: string;
    name: string;
    cloneUrl: string;
    teamId: string;
    appInstallationId: string;
    settings?: ProjectSettings;
    creationTime: string;
    /** This is a flag that triggers the HARD DELETION of this entity */
    deleted?: boolean;
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

    export function slug(p: Project): string {
        return p.name + "-" + p.id;
    }

    /**
     * If *no settings* are present on pre-existing projects, this defaults to `true` (enabled) for
     * backwards compatibility. This allows to do any explicit migration of data or adjustment of
     * the default behavior at a later point in time.
     *
     * Otherwise this returns the value of the `enablePrebuilds` settings persisted in the given
     * project.
     */
    export function isPrebuildsEnabled(project: Project): boolean {
        // Defaulting to `true` for backwards compatibility. Ignoring non-boolean for `enablePrebuilds`
        // for evaluation here allows to do any explicit migration of data or adjustment of the default
        // behavior at a later point in time.
        if (!hasPrebuildSettings(project)) {
            return true;
        }

        return !!project.settings?.enablePrebuilds;
    }

    export function hasPrebuildSettings(project: Project) {
        return !(typeof project.settings?.enablePrebuilds === "undefined");
    }

    export function getPrebuildBranchStrategy(project: Project): ProjectSettings.PrebuildBranchStrategy {
        if (!hasPrebuildSettings(project)) {
            // returning "all branches" to mimic the default value of projects which were added
            // before introduction of persisted settings for prebuilds.
            return "allBranches";
        }
        if (typeof project.settings?.prebuildDefaultBranchOnly === "undefined") {
            return "defaultBranch"; // default value for `settings.prebuildDefaultBranchOnly`
        }
        if (project.settings?.prebuildDefaultBranchOnly) {
            return "defaultBranch";
        }
        const prebuildBranchPattern = project.settings?.prebuildBranchPattern?.trim();
        if (typeof prebuildBranchPattern === "string" && prebuildBranchPattern.length > 1) {
            return "selectedBranches";
        }
        return "allBranches";
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
    /** This is a flag that triggers the HARD DELETION of this entity */
    deleted?: boolean;
}

export interface OrganizationSettings {
    workspaceSharingDisabled?: boolean;
    defaultWorkspaceImage?: string | null;
}

export type TeamMemberRole = OrgMemberRole;
export type OrgMemberRole = "owner" | "member";

export namespace TeamMemberRole {
    export function isValid(role: any): role is TeamMemberRole {
        return role === "owner" || role === "member";
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

export interface PrebuildEvent {
    id: string;
    creationTime: string;
    status: WebhookEvent.Status | WebhookEvent.PrebuildStatus;
    message?: string;
    prebuildId?: string;
    projectId?: string;
    cloneUrl?: string;
    branch?: string;
    commit?: string;
}
