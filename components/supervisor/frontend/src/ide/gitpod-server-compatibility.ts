/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { serverUrl } from "../shared/urls";

const currentHost = new URL(serverUrl.toString()).hostname;

export const isSaaS = currentHost === "gitpod.io";

const versionRegex = new RegExp("main.(\\d+)");

function getVersionInfo(version: string) {
    const result = versionRegex.exec(version);
    if (!result) {
        return;
    }
    return Number(result[1]);
}

const serverVersion = (async () => {
    const url = serverUrl.withApi({ pathname: "/version" }).toString();
    const fetchVersion = async (retry: number) => {
        try {
            const resp = await fetch(url);
            const currentVersionStr = await resp.text();
            return getVersionInfo(currentVersionStr);
        } catch (e) {
            if (retry - 1 <= 0) {
                throw e;
            }
            fetchVersion(retry - 1);
        }
    };
    try {
        return await fetchVersion(3);
    } catch (e) {
        console.error("failed to fetch server verson:", e);
    }
})();

export async function isSaaSServerGreaterThan(version: string) {
    if (!isSaaS) {
        return false;
    }
    const serverVersionNum = await serverVersion;
    const versionNum = getVersionInfo(version);
    return !!serverVersionNum && !!versionNum && serverVersionNum >= versionNum;
}
