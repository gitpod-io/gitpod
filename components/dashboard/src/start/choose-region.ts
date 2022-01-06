/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { getGitpodService } from "../service/service";

/**
 *
 * measureAndPickWorkspaceClusterRegion attempts multiple fetch calls on all available workspace cluster regions.
 * The first region to return those fetch attempts is set as workspace cluster preference.
 *
 * @returns void
 */
async function measureAndPickWorkspaceClusterRegion(): Promise<void> {
    const localStorageKey = "lastRTTMeasurement";

    try {
        let lastCheck = localStorage.getItem(localStorageKey);
        if (!!lastCheck && (Date.now() - Date.parse(lastCheck)) < 6*60*60*1000) {
            // we've recently done the check.
            return;
        }
    } catch (err) {
        // Date.parse can fail ... in which case we assume we haven't done the RTT measurement recently.
        console.log("cannot determine last RTT measurement run", err);
    }

    const eps = await getGitpodService().server.listWorkspaceClusterRTTEndpoints();

    const region = await Promise.race(eps.candidates.map(ep => measureRTT(ep.endpoint, ep.region)));
    if (!region) {
        console.warn("did not find a prefered workspace cluster region");
        return;
    }

    localStorage.setItem(localStorageKey, new Date().toISOString())
    await getGitpodService().server.setWorkspaceClusterPreferences({ region });
}

async function measureRTT(endpoint: string, region: string): Promise<string | undefined> {
    const controller = new AbortController();
    const abort = setTimeout(() => controller.abort(), 1000);

    try {
        await Promise.all(Array(5).map(async () => {
            try {
                await fetch(endpoint, { cache: "no-cache", signal: controller.signal, });
            } catch (err) {
                // we don't want a single error to abort the race. For example, it's ok
                // if the RTT endpoints return 404.
            }
        }))
    } finally {
        clearTimeout(abort);
    }

    return region;
}

export { measureAndPickWorkspaceClusterRegion };