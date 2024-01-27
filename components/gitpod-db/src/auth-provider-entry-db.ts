/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderEntry as AuthProviderEntry } from "@gitpod/gitpod-protocol";
import { createHash } from "crypto";

export const AuthProviderEntryDB = Symbol("AuthProviderEntryDB");

export interface AuthProviderEntryDB {
    storeAuthProvider(ap: AuthProviderEntry, updateOAuthRevision: boolean): Promise<AuthProviderEntry>;

    delete(ap: AuthProviderEntry): Promise<void>;

    findAll(exceptOAuthRevisions?: string[]): Promise<AuthProviderEntry[]>;
    /**
     * `host`s contained in the result array are expected to be lower case.
     */
    findAllHosts(): Promise<string[]>;
    findByHost(host: string): Promise<AuthProviderEntry | undefined>;
    findById(id: string): Promise<AuthProviderEntry | undefined>;
    findByUserId(userId: string): Promise<AuthProviderEntry[]>;
    findByOrgId(organizationId: string): Promise<AuthProviderEntry[]>;
}

export function hashOAuth(oauth: AuthProviderEntry["oauth"]): string {
    return createHash("sha256").update(JSON.stringify(oauth)).digest("hex");
}
