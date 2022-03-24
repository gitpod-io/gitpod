/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Connection, ConnectionType, EnvVarWithValue, TaskConfig } from "@gitpod/gitpod-protocol";

export class ConnectionsWorkspaceModifier {
    constructor(readonly connection: Connection, readonly type: ConnectionType) {}

    protected render(template: string) {
        let result = template;
        for (const attribute of this.type.attributes) {
            result = result?.replace(`\$\{${attribute}\}`, this.connection[attribute]);
        }
        return result;
    }

    async getEnvVars(): Promise<EnvVarWithValue[]> {
        return this.type.envVars.map((ev) => ({
            name: ev.name,
            value: this.render(ev.value),
        }));
    }

    async getTasks(): Promise<TaskConfig[]> {
        return this.type.tasks.map((t) => ({
            name: t.name,
            value: this.render(t.command),
        }));
    }

    async getAdditionalContainerImages(): Promise<string[]> {
        return this.type.imageLayers
            .filter((il) => !!il)
            .map((il) => this.render(il))
            .filter((il) => !!il);
    }
}
