/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";

export const SpiceDBClient = Symbol("SpiceDBClient");
export type SpiceDBClient = v1.ZedPromiseClientInterface;

export function spicedbClientFromEnv(): v1.ZedPromiseClientInterface {
    const token = process.env["SPICEDB_PRESHARED_KEY"];
    if (!token) {
        throw new Error("No spicedb token configured.");
    }

    const address = process.env["SPICEDB_ADDRESS"];
    if (!address) {
        throw new Error("No spicedb address configured.");
    }

    const client = v1.NewClient(token, address, v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS);
    return client.promises;
}
