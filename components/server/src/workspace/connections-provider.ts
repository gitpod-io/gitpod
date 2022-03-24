/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, postConstruct } from "inversify";
import * as yaml from "js-yaml";
import * as path from "path";
import * as fs from "fs";
import { ConnectionType } from "@gitpod/gitpod-protocol";

@injectable()
export class ConnectionsProvider {
    protected types: { [key: string]: ConnectionType } = {};

    @postConstruct()
    protected init() {
        const yml = yaml.load(fs.readFileSync(ConnectionsProvider.CONNECTIONS_YML_PATH, "utf8"));
        console.warn(`ConnectionsProvider`, { yml });
        this.types = yml as { [key: string]: ConnectionType };
    }

    getConnectionTypes() {
        return this.types;
    }
}

export namespace ConnectionsProvider {
    export const CONNECTIONS_YML_PATH = path.resolve(__dirname, "../../connections.yml");
}
