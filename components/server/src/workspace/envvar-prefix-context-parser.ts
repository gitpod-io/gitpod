/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { IPrefixContextParser } from "./context-parser";
import { User, WorkspaceContext, UserEnvVarValue, WithEnvvarsContext } from "@gitpod/gitpod-protocol";
import { injectable } from "inversify";

const envvarRegexp = /([\w-_]+)=([^,/=]+)(,([\w-_]+)=([^,/=]+))*\//;

@injectable()
export class EnvvarPrefixParser implements IPrefixContextParser {

    public findPrefix(user: User, context: string): string | undefined {
        const matches = envvarRegexp.exec(context);
        if (!matches) {
            return;
        }

        return matches[0];
    }

    public async handle(user: User, prefix: string, context: WorkspaceContext): Promise<WorkspaceContext> {
        const matches = envvarRegexp.exec(prefix);
        if (!matches) {
            return context;
        }

        const envvars: UserEnvVarValue[] = [];
        for (let i = 0; i < matches.length; ) {
            // skip first element of this group-of-three: it's outer group as a whole
            i++;
            // second group is the name
            const name = matches[i++];
            // third group is the value
            const value = decodeURIComponent(matches[i++]);

            envvars.push({ name, value, repositoryPattern: "#/#" });
        }

        return <WithEnvvarsContext>{
            ...context,
            envvars
        };
    }

}