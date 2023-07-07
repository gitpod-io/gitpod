/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Redis } from "ioredis";

export function newRedisClient(host: string, port: number): Redis {
    return new Redis({
        port: Number(port),
        host,
        enableReadyCheck: true,
        keepAlive: 10 * 1000,
        connectionName: "server",
    });
}
