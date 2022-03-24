/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { EnvVarWithValue, TailscaleConnection, TaskConfig } from "@gitpod/gitpod-protocol";

export interface ConnectionsWorkspaceModifier {
    getEnvVars(connection: TailscaleConnection): Promise<EnvVarWithValue[]>;
    getTasks(connection: TailscaleConnection): Promise<TaskConfig[]>;
}

export class TailscaleWorkspaceModifier implements ConnectionsWorkspaceModifier {
    constructor(readonly connection: TailscaleConnection) {}

    async getEnvVars(): Promise<EnvVarWithValue[]> {
        return [];
    }

    async getTasks(): Promise<TaskConfig[]> {
        const connection = this.connection;
        if (!connection.authKey) {
            return [];
        }
        return [
            {
                name: "tailscaled",
                command: `
                curl -fsSL https://tailscale.com/install.sh | sh
                gp sync-done tailscale-install

                sudo tailscaled`,
            },
            {
                name: "tailscale",
                command: `
                gp sync-await tailscale-install
                sudo -E tailscale up --authkey ${connection.authKey}
                `,
            },
        ];
    }
}
