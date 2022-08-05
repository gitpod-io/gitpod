/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { DBWithTracing, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { User, Workspace } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
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

    // The resources that this class provides
    resources: WorkspaceClassResources;
}

export interface WorkspaceClassResources {
    // Storage in gigabyte
    storage: number;
    // Number of cpus
    cpu: number;
    // Memory in gigabyte
    memory: number;
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

    /**
     * Gets the workspace class of the prebuild
     * If the class is not supported anymore undefined will be returned
     * @param ctx
     * @param workspace
     * @param db
     * @param classes
     */
    export async function getFromPrebuild(
        ctx: TraceContext,
        workspace: Workspace,
        db: DBWithTracing<WorkspaceDB>,
        classes: WorkspaceClassesConfig,
    ): Promise<string | undefined> {
        const span = TraceContext.startSpan("getFromPrebuild", ctx);
        try {
            if (!workspace.basedOnPrebuildId) {
                return undefined;
            }

            const prebuild = await db.trace({ span }).findPrebuildByID(workspace.basedOnPrebuildId);
            if (!prebuild) {
                return undefined;
            }

            const buildWorkspaceInstance = await db.trace({ span }).findCurrentInstance(prebuild.buildWorkspaceId);
            return buildWorkspaceInstance?.id;
        } finally {
            span.finish();
        }
    }

    /**
     * @param user
     * @param classes
     * @param entitlementService
     */
    export async function getConfiguredOrUpgradeFromLegacy(
        user: User,
        classes: WorkspaceClassesConfig,
        entitlementService: EntitlementService,
    ): Promise<string> {
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
     * Checks if the current class can be replaced by another class
     * - If both classes are the same the current class will be returned
     * - If the proposed substitute class has at least as much resources as the current class replace it
     * - If the substitute does not provide sufficient resources
     *   - If current class is deprecated
     *     - Try to find another class that provides at least as much resources as the deprecated one
     *     - If this also fails, return default class
     *   - If current class is not deprecated return current class
     * @param currentClassId
     * @param substituteClassId
     * @param classes
     */
    export function canSubstitute(
        currentClassId: string,
        substituteClassId: string | undefined,
        classes: WorkspaceClassesConfig,
    ): string {
        if (currentClassId === substituteClassId) {
            return currentClassId;
        }

        const current = classes.find((c) => c.id === currentClassId);
        let substitute = classes.find((c) => c.id === substituteClassId);

        if (!current) {
            throw new Error("class not defined: " + currentClassId);
        }

        if (!substitute) {
            throw new Error("class not defined: " + substituteClassId);
        }

        if (substitute.deprecated) {
            substitute = classes.find((c) => c.id === getMoreResourcesIdOrDefault(classes));
        }

        if (substitute && providesMinimalResources(substitute, current)) {
            return substitute.id;
        }

        if (current.deprecated) {
            const alternative = classes
                .sort((a, b) => a.resources.storage - b.resources.storage)
                .find((cl) => providesMinimalResources(cl, current));
            if (!alternative) {
                return getDefaultId(classes);
            } else {
                return alternative.id;
            }
        }

        return current.id;
    }

    function providesMinimalResources(class1: WorkspaceClassConfig, class2: WorkspaceClassConfig): boolean {
        return (
            class1.category === class2.category &&
            class1.resources.cpu >= class2.resources.cpu &&
            class1.resources.memory >= class2.resources.memory &&
            class1.resources.storage >= class2.resources.storage
        );
    }
}
