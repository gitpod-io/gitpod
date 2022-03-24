/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { EnvVarWithValue, GCloudAdcConnection, TailscaleConnection, TaskConfig } from "@gitpod/gitpod-protocol";

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

export class GCloudAdcWorkspaceModifier implements ConnectionsWorkspaceModifier {
    constructor(readonly connection: GCloudAdcConnection) {}

    static readonly GCLOUD_ADC_PATH = "/home/gitpod/.config/gcloud/application_default_credentials.json";

    async getEnvVars(): Promise<EnvVarWithValue[]> {
        return [
            {
                name: "GOOGLE_APPLICATION_CREDENTIALS",
                value: GCloudAdcWorkspaceModifier.GCLOUD_ADC_PATH,
            },
        ];
    }

    async getTasks(): Promise<TaskConfig[]> {
        const connection = this.connection;
        if (!connection.serviceAccount) {
            return [];
        }
        return [
            {
                name: "GCloud ADC",
                command: `
                GCLOUD_ADC_PATH="${GCloudAdcWorkspaceModifier.GCLOUD_ADC_PATH}"
                if [ ! -f "$GCLOUD_ADC_PATH" ]; then
                    mkdir -p $(dirname $GCLOUD_ADC_PATH)
                    echo '${connection.serviceAccount}' > "$GCLOUD_ADC_PATH"
                fi`,
            },
        ];
    }
}
