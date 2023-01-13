/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User, WorkspaceContext } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { OpenPrebuildContext } from "@gitpod/gitpod-protocol/lib/protocol";
import { inject, injectable } from "inversify";
import { Config } from "../config";
import { IPrefixContextParser } from "./context-parser";

@injectable()
export class OpenPrebuildPrefixContextParser implements IPrefixContextParser {
    @inject(Config) protected readonly config: Config;
    static PREFIX = /^\/?open-prebuild\/([^\/]*)\//;

    findPrefix(user: User, context: string): string | undefined {
        const result = OpenPrebuildPrefixContextParser.PREFIX.exec(context);
        if (!result) {
            return undefined;
        }
        return result[0];
    }

    public async handle(user: User, prefix: string, context: WorkspaceContext): Promise<WorkspaceContext> {
        const match = OpenPrebuildPrefixContextParser.PREFIX.exec(prefix);
        if (!match) {
            log.error("Could not parse prefix " + prefix);
            return context;
        }

        (context as OpenPrebuildContext).openPrebuildID = match[1];
        return context;
    }
}
