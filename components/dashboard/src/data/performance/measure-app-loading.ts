/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";

const metricName = "gitpod_dashboard_page_navigation_duration_seconds";
const metricsUrl = new GitpodHostUrl(window.location.href).withoutWorkspacePrefix().asIDEMetrics().toString();
const maxDuration = 30000; // 30 seconds
const DEBUG = true;

type ProcessEvent = "userLoaded" | "orgsLoaded" | "appLoaded";
interface Result {
    complete: () => void;
    setShouldSend: (shouldSend: boolean) => void;
}
const eventState: Record<ProcessEvent, { sent: boolean; started: boolean; storedResult?: Result }> = {
    userLoaded: { sent: false, started: false },
    orgsLoaded: { sent: false, started: false },
    appLoaded: { sent: false, started: false },
};

// firstScreenLoggedIn is used to determine if the user is logged in on the first screen.
// if the user is not logged in, we don't report orgsLoaded and appLoaded because <Login> can cost a lot of time.
let _firstScreenLoggedIn: undefined | boolean = undefined;
export const firstScreenLoggedIn = {
    get value() {
        return _firstScreenLoggedIn;
    },
    set value(val: undefined | boolean) {
        if (_firstScreenLoggedIn === undefined) {
            _firstScreenLoggedIn = val;
        }
    },
};

export function measureProcessCompleteMetric(event: ProcessEvent, baseShouldSend: boolean = true): Result {
    if (eventState[event].started) {
        return eventState[event].storedResult!;
    }
    let shouldSend = baseShouldSend;
    eventState[event].started = true;

    let timer: NodeJS.Timeout | null;

    // Must send after 10 seconds, 10 should be the max bucket of the histogram too.
    timer = setTimeout(() => complete(), maxDuration);

    const listener = () => {
        if (!shouldSend || eventState[event].sent) {
            return;
        }
        observeHistogramWithBeacon(metricName, { event }, getDuration());
    };
    window.addEventListener("unload", listener);

    const clean = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        window.removeEventListener("unload", listener);
    };

    const complete = async () => {
        if (!shouldSend || eventState[event].sent) {
            return;
        }
        const duration = getDuration();
        clean();
        eventState[event].sent = true;
        await observeHistogram(metricName, { event }, duration);
    };

    const setShouldSend = (should: boolean) => {
        shouldSend = should;
    };

    eventState[event].storedResult = { complete, setShouldSend };

    return { complete, setShouldSend };
}

function getDuration() {
    // peformance.now() returns the ms since navigation startTime (0)
    return performance.now() / 1000;
}

function observeHistogramWithBeacon(name: string, labels: Record<string, string>, value: number) {
    if (DEBUG) {
        console.log("====observeHistogramWithBeacon", name, labels, value);
    }
    labels.source = "beacon";
    return navigator.sendBeacon(`${metricsUrl}/metrics/histogram/observe/${name}`, JSON.stringify({ labels, value }));
}

async function observeHistogram(name: string, labels: Record<string, string>, value: number) {
    if (DEBUG) {
        console.log("====observeHistogram", name, labels, value);
    }
    labels.source = "fetch";
    const url = `${metricsUrl}/metrics/histogram/observe/${name}`;
    try {
        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify({ labels, value }),
            credentials: "omit",
        });
        if (!response.ok) {
            const data = await response.json(); // { code: number; message: string; }
            console.error(
                `Cannot report metrics with observeHistogram: ${response.status} ${response.statusText}`,
                data,
            );
            return false;
        }
        return true;
    } catch (err) {
        console.error("Cannot report metrics with observeHistogram, error:", err);
        return false;
    }
}
