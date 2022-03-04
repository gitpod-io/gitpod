/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { IPrefixContextParser } from "./context-parser";
import { User, WorkspaceContext, WithEnvvarsContext } from "@gitpod/gitpod-protocol";
import { injectable } from "inversify";
import { EnvVarWithValue } from "@gitpod/gitpod-protocol/src/protocol";

@injectable()
export class EnvvarPrefixParser implements IPrefixContextParser {

    public findPrefix(user: User, context: string): string | undefined {
        const result = this.parse(context);
        return result && result.prefix;
    }

    public async handle(user: User, prefix: string, context: WorkspaceContext): Promise<WorkspaceContext> {
        const result = this.parse(prefix);
        if (!result) {
            return context;
        }

        const envvars: EnvVarWithValue[] = [];
        for (const [k, v] of result.envVarMap.entries()) {
            envvars.push({ name: k, value: decodeURIComponent(v) });
        }
        return <WithEnvvarsContext>{
            ...context,
            envvars
        };
    }

    protected parse(ctx: string) {
        const splitBySlash = ctx.split("/");
        if (splitBySlash.length < 2) {
            return; // "/" not found
        }
        const envVarMap = new Map<string, string>();
        const prefix = splitBySlash[0];
        const kvCandidates = prefix.split(",");
        for (let kvCandidate of kvCandidates) {
            const kv = kvCandidate.split("=");
            if (kv.length !== 2 || !kv[0] || !kv[1] || !kv[0].match(/^[\w-_]+$/)) {
                continue;
            }
            envVarMap.set(kv[0], kv[1]);
        }
        if (envVarMap.size === 0) {
            return undefined;
        }
        return {
            prefix: prefix + "/",
            envVarMap
        }
    }

}