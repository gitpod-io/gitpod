/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { User, WorkspaceContext, StartPrebuildContext, IssueContext, ContextURL } from "@gitpod/gitpod-protocol";
import { injectable } from "inversify";
import { IPrefixContextParser } from "../../../src/workspace/context-parser";

@injectable()
export class StartPrebuildContextParser implements IPrefixContextParser {
    static PREFIX = ContextURL.PREBUILD_PREFIX + '/';

    findPrefix(user: User, context: string): string | undefined {
        if (context.startsWith(StartPrebuildContextParser.PREFIX)) {
            return StartPrebuildContextParser.PREFIX;
        }
    }

    public async handle(user: User, prefix: string, context: WorkspaceContext): Promise<WorkspaceContext> {
        if (IssueContext.is(context)) {
            throw new Error("cannot start prebuilds on an issue context")
        }

        const result: StartPrebuildContext = {
            title: `Prebuild of "${context.title}"`,
            actual: context
        };
        return result;
    }

}