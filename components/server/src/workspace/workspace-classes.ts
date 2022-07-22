/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

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

    /**
     * Checks that the given workspaceClass is:
     *  - still configured
     *  - not deprecated
     * If any of that is the case, it returns the default class
     *
     * @param workspaceClasses
     * @param previousWorkspaceClass
     */
    export function getPreviousOrDefault(
        workspaceClasses: WorkspaceClassesConfig,
        previousWorkspaceClass: string | undefined,
    ): string {
        if (!previousWorkspaceClass) {
            return getDefaultId(workspaceClasses);
        }

        const config = workspaceClasses.find((c) => c.id === previousWorkspaceClass);
        if (!config) {
            log.error(
                `Found previous instance with workspace class '${previousWorkspaceClass}' which is no longer configured! Falling back to default class.`,
                { workspaceClasses },
            );
            return getDefaultId(workspaceClasses);
        }
        if (config.deprecated) {
            log.info(
                `Found previous instance with workspace class '${previousWorkspaceClass}' which is deprecated. Falling back to default class.`,
                { workspaceClasses },
            );
            return getDefaultId(workspaceClasses);
        }
        return config.id;
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
}
