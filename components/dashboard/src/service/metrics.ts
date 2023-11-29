/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MetricsReporter } from "@gitpod/public-api/lib/metrics";
import { v4 } from "uuid";
const commit = require("./config.json").commit;

const originalConsoleError = console.error;

const metricsReporter = new MetricsReporter({
    gitpodUrl: window.location.href,
    clientName: "dashboard",
    clientVersion: commit,
    log: {
        error: originalConsoleError.bind(console),
        debug: console.debug.bind(console),
    },
    isEnabled: () => Promise.resolve(false),
    commonErrorDetails: {
        sessionId: v4(),
    },
});
metricsReporter.startReporting();

window.addEventListener("unhandledrejection", (event) => {
    reportError("Unhandled promise rejection", event.reason);
});
window.addEventListener("error", (event) => {
    let message = "Unhandled error";
    if (event.message) {
        message += ": " + event.message;
    }
    reportError(message, event.error);
});

console.error = function (...args) {
    originalConsoleError.apply(console, args);
    reportError(...args);
};

export function updateCommonErrorDetails(update: { [key: string]: string | undefined }) {
    metricsReporter.updateCommonErrorDetails(update);
}

export function instrumentWebSocket(ws: WebSocket, origin: string) {
    metricsReporter.instrumentWebSocket(ws, origin);
}

export function reportError(...args: any[]) {
    let err = undefined;
    let details = undefined;
    if (args[0] instanceof Error) {
        err = args[0];
        details = args[1];
    } else if (typeof args[0] === "string") {
        err = new Error(args[0]);
        if (args[1] instanceof Error) {
            err.message += ": " + args[1].message;
            err.name = args[1].name;
            err.stack = args[1].stack;
            details = args[2];
        } else if (typeof args[1] === "string") {
            err.message += ": " + args[1];
            details = args[2];
        } else {
            details = args[1];
        }
    }

    let data = {};
    if (details && typeof details === "object") {
        data = Object.assign(
            data,
            Object.fromEntries(
                Object.entries(details)
                    .filter(([key, value]) => {
                        return (
                            typeof value === "string" ||
                            typeof value === "number" ||
                            typeof value === "boolean" ||
                            value === null ||
                            typeof value === "undefined"
                        );
                    })
                    .map(([key, value]) => [key, String(value)]),
            ),
        );
    }

    if (err) {
        metricsReporter.reportError(err, data);
    }
}
