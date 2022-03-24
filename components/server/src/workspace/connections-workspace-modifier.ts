/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ProjectDB } from "@gitpod/gitpod-db/lib";
import { EnvVarWithValue } from "@gitpod/gitpod-protocol";

export interface ConnectionsWorkspaceModifier {
    getEnvVars(): Promise<EnvVarWithValue[]>;
}

export class TailscaleWorkspaceModifier implements ConnectionsWorkspaceModifier {
    constructor(protected readonly projectDB: ProjectDB) {}

    async getEnvVars(): Promise<EnvVarWithValue[]> {
        return [];
    }
}
