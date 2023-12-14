/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as prometheusClient from "prom-client";
import { LogHook } from "./logging";

const logsCounter = new prometheusClient.Counter({
    name: "gitpod_logs_total",
    help: "Total number of logs by level",
    labelNames: ["level"],
    registers: [prometheusClient.register],
});

export function reportLogCount(level: string) {
    logsCounter.inc({ level });
}

export function installLogCountMetric() {
    LogHook.setHook((item) => {
        reportLogCount((item.severity || "").toLowerCase());
    });
}
