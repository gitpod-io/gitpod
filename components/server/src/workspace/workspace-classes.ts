/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

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

    // Marks this class to have special semantics
    marker?: {
        // Marks this class as the one that users marked with "GetMoreResources" receive
        moreResources: boolean;
    };
}
