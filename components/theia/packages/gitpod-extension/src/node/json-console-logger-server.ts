/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


import { ConsoleLoggerServer } from '@theia/core/lib/node/console-logger-server'
import { LogLevel } from '@theia/core';

export class JsonConsoleLoggerServer extends ConsoleLoggerServer {

    // tslint:disable:no-any
    async log(name: string, logLevel: number, message: string, params: any[]): Promise<void> {
        const configuredLogLevel = await this.getLogLevel(name);
        if (logLevel >= configuredLogLevel) {
            const item = {
                component: "workspace",
                severity: LogLevel.strings.get(logLevel),
                time: new Date().toISOString(),
                environment: process.env.KUBE_STAGE,
                region: process.env.GITPOD_REGION,
                message,
                payload: {
                    name,
                    params
                }
            }
            process.stdout.write(JSON.stringify(item) + "\n");
        }
    }

}