/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol/lib/protocol";
import { Project } from "@gitpod/gitpod-protocol/lib/teams-projects-protocol";
import { EntitlementService } from "../billing/entitlement-service";

export type WorkspaceClassesConfig = [WorkspaceClassConfig];

export interface WorkspaceClassConfig {
    // The technical string we use to identify the class with internally
    id: string;

    // Is the "default" class. The config is validated to only every have exactly _one_ default class.
    isDefault: boolean;

    // Identifies which category this class belongs to e.g. general purpose
    category: string;

    // The string we display to users in the UI
    displayName: string;

    // The description for the workspace class
    description: string;

    // The "power level" of the workspace class
    powerups: number;

    // Whether or not to:
    //  - offer users this Workspace class for selection
    //  - use this class to start workspaces with. If a user has a class marked like this configured and starts a workspace they get the default class instead.
    deprecated: boolean;

    // Marks this class to have special semantics
    marker?: {
        // Marks this class as the one that users marked with "GetMoreResources" receive
        moreResources: boolean;
    };
}

export namespace WorkspaceClasses {
    /**
     * @param workspaceClasses
     * @return The WorkspaceClass ID of the first class that is marked with "moreResources" (and not deprecated). Falls back to "getDefaultId()".
     */
    export function getMoreResourcesIdOrDefault(workspaceClasses: WorkspaceClassesConfig): string {
        const moreResources = workspaceClasses.filter((c) => !c.deprecated).find((c) => !!c.marker?.moreResources);
        if (moreResources) {
            return moreResources.id;
        }

        // fallback: default
        return getDefaultId(workspaceClasses);
    }

    /**
     * @param workspaceClasses
     * @return The WorkspaceClass ID of the "default" class
     */
    export function getDefaultId(workspaceClasses: WorkspaceClassesConfig): string {
        validate(workspaceClasses);

        return workspaceClasses.filter((c) => !c.deprecated).find((c) => c.isDefault)!.id;
    }

    export function validate(workspaceClasses: WorkspaceClassesConfig): void {
        const defaultClasses = workspaceClasses
            .filter((c) => !c.deprecated)
            .map((c) => (c.isDefault ? 1 : 0))
            .reduce((acc: number, isDefault: number) => (acc + isDefault) as number, 0);

        if (defaultClasses !== 1) {
            throw new Error(
                "Exactly one default workspace class needs to be configured:" + JSON.stringify(defaultClasses),
            );
        }
    }

    /**
     * @param user
     * @param classes
     * @param entitlementService
     */
    export async function getConfiguredOrUpgradeFromLegacy(
        user: User,
        project: Project | undefined,
        classes: WorkspaceClassesConfig,
        entitlementService: EntitlementService,
    ): Promise<string> {
        if (project?.settings?.workspaceClasses?.regular) {
            return project?.settings?.workspaceClasses?.regular;
        }
        if (user.additionalData?.workspaceClasses?.regular) {
            return user.additionalData?.workspaceClasses?.regular;
        }

        let workspaceClass = WorkspaceClasses.getDefaultId(classes);
        if (await entitlementService.userGetsMoreResources(user)) {
            workspaceClass = WorkspaceClasses.getMoreResourcesIdOrDefault(classes);
        }

        return workspaceClass;
    }

    /**
     * @param currentClassId
     * @param substituteClassId
     * @param classes
     */
    export function selectClassForRegular(
        currentClassId: string,
        substituteClassId: string | undefined,
        classes: WorkspaceClassesConfig,
    ): string {
        if (currentClassId === substituteClassId) {
            return currentClassId;
        }

        const current = classes.find((c) => c.id === currentClassId);
        let substitute = classes.find((c) => c.id === substituteClassId);

        // todo: remove this once pvc has been rolled out
        if (currentClassId.endsWith("-pvc")) {
            return currentClassId;
        }

        if (current?.marker?.moreResources) {
            if (substitute?.marker?.moreResources) {
                return substitute?.id;
            } else {
                if (current.deprecated) {
                    return getMoreResourcesIdOrDefault(classes);
                } else {
                    return current.id;
                }
            }
        } else {
            if (substitute?.id) {
                return substitute.id;
            } else {
                return getDefaultId(classes);
            }
        }
    }
}
