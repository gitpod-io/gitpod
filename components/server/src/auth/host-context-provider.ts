/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HostContext, HostServices } from "./host-context";

export const HostContextProvider = Symbol("HostContextProvider");

export interface HostContextProvider {
    init(): Promise<void>;
    getAll(): HostContext[];
    get(host: string): HostContext | undefined;
    findByAuthProviderId(authProviderId: string): HostContext | undefined;
}

export const HostServicesFactory = Symbol("HostServicesFactory");

export interface HostServicesFactory {
    createHostServices: (type: string) => HostServices | undefined;
}
