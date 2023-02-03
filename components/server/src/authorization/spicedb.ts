/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

export const SpiceDBClient = Symbol("SpiceDBClient");
export type SpiceDBClient = v1.ZedPromiseClientInterface | undefined;

export function spicedbClientFromEnv(): SpiceDBClient {
    const token = process.env["SPICEDB_PRESHARED_KEY"];
    if (!token) {
        log.error("[spicedb] No preshared key configured.");
        return;
    }

    const address = process.env["SPICEDB_ADDRESS"];
    if (!address) {
        log.error("[spicedb] No service address configured.");
        return;
    }

    return v1.NewClient(token, address, v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS).promises;
}
