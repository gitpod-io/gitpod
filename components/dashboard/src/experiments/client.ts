/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as configcat from "configcat-js";
import { ConfigCatClient } from "@gitpod/gitpod-protocol/lib/experiments/configcat";
import { Client } from "@gitpod/gitpod-protocol/lib/experiments/types";
import { LogLevel } from "configcat-common";

let client: Client | undefined;

export function getExperimentsClient(): Client {
    // We have already instantiated a client, we can just re-use it.
    if (client !== undefined) {
        return client;
    }

    client = newProxyConfigCatClient();
    return client;
}

function newProxyConfigCatClient(): Client {
    const clientKey = "gitpod"; // the client key is populated by the proxy
    const client = configcat.createClientWithLazyLoad(clientKey, {
        logger: configcat.createConsoleLogger(LogLevel.Error),
        cacheTimeToLiveSeconds: 60 * 3, // 3 minutes
        requestTimeoutMs: 1500,
        baseUrl: `${window.location.origin}/configcat`,
    });

    return new ConfigCatClient(client);
}
