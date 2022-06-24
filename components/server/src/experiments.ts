/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as configcat from "configcat-node";
import { IConfigCatClient } from "configcat-common/lib/ConfigCatClient";

let logger = configcat.createConsoleLogger(3); // Setting log level to 3 (Info)
let client: IConfigCatClient | undefined;

export function getExperimentsClient(): IConfigCatClient {
    if (client === undefined) {
        client = configcat.createClient("WBLaCPtkjkqKHlHedziE9g/LEAOCNkbuUKiqUZAcVg7dw", {
            // <-- This is the actual SDK Key for your Test environment
            maxInitWaitTimeSeconds: 0,
            logger: logger,
        });
    }

    return client;
}
