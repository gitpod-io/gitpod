/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/**
 * @see https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/oauth?view=azure-devops
 */
export namespace AzureDevOpsScopes {
    export const READ_USER = "https://app.vssps.visualstudio.com/vso.profile";
    export const READ_REPO = "https://app.vssps.visualstudio.com/vso.code_write";
    // extend token lifetime
    export const OFFLINE_ACCESS = "offline_access";

    export const All = [READ_USER, READ_REPO];
    export const Requirements = {
        DEFAULT: [READ_USER, OFFLINE_ACCESS],

        REPO: [READ_REPO],
    };
}
