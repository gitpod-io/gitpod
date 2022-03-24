/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ProjectDB } from "@gitpod/gitpod-db/lib";
import { CommitContext, EnvVarWithValue, TaskConfig } from "@gitpod/gitpod-protocol";

export interface ConnectionsWorkspaceModifier {
    getEnvVars(): Promise<EnvVarWithValue[]>;
    getTasks(userId: string, workspace: CommitContext): Promise<TaskConfig[]>;
}

export class TailscaleWorkspaceModifier implements ConnectionsWorkspaceModifier {
    constructor(protected readonly projectDB: ProjectDB) {}

    async getEnvVars(): Promise<EnvVarWithValue[]> {
        return [];
    }

    async getTasks(userId: string, context: CommitContext): Promise<TaskConfig[]> {
        const hostname = `gitpod-${userId}-${context.repository.name}`;
        return [
            {
                name: "tailscaled",
                command: `
                curl -fsSL https://tailscale.com/install.sh | sh
                gp sync-done tailscale-install
                if [ -n "\${TAILSCALE_STATE_MYPROJECT}" ]; then
                    # restore the tailscale state from gitpod user's env vars
                    sudo mkdir -p /var/lib/tailscale
                    echo "\${TAILSCALE_STATE_MYPROJECT}" | sudo tee /var/lib/tailscale/tailscaled.state > /dev/null
                fi
                sudo tailscaled`,
            },
            {
                name: "tailscale",
                command: `
                gp sync-await tailscale-install
                if [ -n "\${TAILSCALE_STATE_MYPROJECT}" ]; then
                    sudo -E tailscale up
                else
                    sudo -E tailscale up --hostname "${hostname}"
                    # store the tailscale state into gitpod user
                    gp env TAILSCALE_STATE_MYPROJECT="$(sudo cat /var/lib/tailscale/tailscaled.state)"
                fi`,
            },
        ];
    }
}
