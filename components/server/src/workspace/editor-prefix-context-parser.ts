/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { IPrefixContextParser } from "./context-parser";
import { User, WorkspaceContext, WithEditorContext } from "@gitpod/gitpod-protocol";
import { injectable } from "inversify";

@injectable()
export class EditorPrefixParser implements IPrefixContextParser {
    private readonly prefix = /^\/?editor:([^\/:]*?)(?::([^\/:]*?))?\//;

    findPrefix(_: User, context: string): string | undefined {
        return this.prefix.exec(context)?.[0] || undefined;
    }

    async handle(_: User, prefix: string, context: WorkspaceContext): Promise<WorkspaceContext | WithEditorContext> {
        const matches = this.prefix.exec(prefix);
        const ide = matches?.[1];
        const useLatest = matches?.[2] === "latest";
        return ide ? { ...context, ide, useLatest } : context;
    }
}
