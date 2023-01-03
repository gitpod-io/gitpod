/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User, WorkspaceContext, ContextURL } from "@gitpod/gitpod-protocol";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { injectable } from "inversify";
import { ResponseError } from "vscode-ws-jsonrpc";
import { IPrefixContextParser } from "../../../src/workspace/context-parser";

@injectable()
export class StartPrebuildContextParser implements IPrefixContextParser {
    static PREFIX = ContextURL.PREBUILD_PREFIX + "/";

    findPrefix(user: User, context: string): string | undefined {
        if (context.startsWith(StartPrebuildContextParser.PREFIX)) {
            return StartPrebuildContextParser.PREFIX;
        }
    }

    public async handle(user: User, prefix: string, context: WorkspaceContext): Promise<WorkspaceContext> {
        throw new ResponseError(
            ErrorCodes.PROJECT_REQUIRED,
            `Running prebuilds without a project is no longer supported. Please add your repository as a project in a team.`,
        );
    }
}
