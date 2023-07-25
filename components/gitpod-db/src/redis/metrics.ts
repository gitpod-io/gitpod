/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as client from "prom-client";

const registry = new client.Registry();

export function redisMetricsRegistry(): client.Registry {
    return registry;
}

export const updatesPublishedTotal = new client.Counter({
    name: "gitpod_redis_updates_published_total",
    help: "Counter of events published to Redis by type and error",
    labelNames: ["type", "error"],
    registers: [registry],
});

export function reportUpdatePublished(type: "workspace-instance" | "prebuild" | "headless", err?: Error): void {
    updatesPublishedTotal.labels(type, err ? "true" : "false").inc();
}
