/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { EnvVariablesServerImpl } from "@theia/core/lib/node/env-variables";
import { FileUri } from "@theia/core/lib/node/file-uri";
import { injectable } from "inversify";

@injectable()
export class GitpodEnvVariablesServer extends EnvVariablesServerImpl {

    getDrives(): Promise<string[]> {
        return Promise.resolve([FileUri.create("/").toString()]);
    }

}