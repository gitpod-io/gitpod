/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import { URL } from 'url'
import { User, ArchiveContext } from "@gitpod/gitpod-protocol";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { IContextParser } from "../workspace/context-parser";

@injectable()
export class ArchiveContextParser implements IContextParser {

    static SUPPORTED_EXTENSIONS = ['.zip', '.tar'];

    canHandle(user: User, contextUrl: string): boolean {
        try {
            const archiveUrl = new URL(contextUrl);
            return !!archiveUrl && ArchiveContextParser.SUPPORTED_EXTENSIONS.some(ext => archiveUrl.pathname.endsWith(ext));
        } catch (error) {
            // The context is not a URL - this is not an archive context
        }
        return false;
    }

    async handle(ctx: TraceContext, user: User, contextUrl: string): Promise<ArchiveContext> {
        const span = TraceContext.startSpan("ArchiveContextParser.handle", ctx);
        span.finish();

        return {
            title: 'Archive',
            archiveUrl: contextUrl,
        }
    }

    async fetchCommitHistory(ctx: TraceContext, user: User, contextUrl: string, commit: string, maxDepth: number): Promise<string[] | undefined> {
        throw new Error("ArchiveContextParser does not support fetching commit history");
    }

}