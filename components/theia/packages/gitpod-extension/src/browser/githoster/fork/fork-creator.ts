/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


export interface ForkCreator {
    createFork(repo: { name: string, owner: string }, organization?: string): Promise<string | undefined>;
}

export namespace ForkCreator {
    export const TYPE = Symbol("ForkCreator");
    export const FACTORY_TYPE = Symbol("Factory<ForkCreator>");
    export const GENERIC_CREATE_FORK_ERROR = new Error("Failed to create a fork.");
}
