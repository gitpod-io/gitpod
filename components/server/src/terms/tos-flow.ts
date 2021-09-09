/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Identity, Token, UserEnvVar, User } from "@gitpod/gitpod-protocol";
import { AuthUser } from "../auth/auth-provider";
import { saveSession } from "../express-util";


export interface TosFlow {
    flowId?: string;
    termsAcceptanceRequired?: boolean;
    isBlocked?: boolean;
    authHost?: string;
}
export namespace TosFlow {
    export function is(data?: any): data is TosFlow {
        return WithUser.is(data) || WithIdentity.is(data);
    }
    export interface WithIdentity extends TosFlow {
        candidate: Identity;
        authUser: AuthUser;
        token: Token;
        additionalIdentity?: Identity;
        additionalToken?: Token;
        envVars?: UserEnvVar[]
    }
    export namespace WithIdentity {
        export function is(data?: any): data is WithIdentity {
            return typeof data === "object" && "candidate" in data && "authUser" in data;
        }
    }
    export interface WithUser extends TosFlow {
        user: User;
        elevateScopes?: string[] | undefined;
        returnToUrl?: string;
    }
    export namespace WithUser {
        export function is(data?: TosFlow): data is WithUser {
            return typeof data === "object" && "user" in data;
        }
    }

    const storageKey = "tosFlowInfo";
    //@ts-ignore
    export function get(session: Express.Session | undefined): TosFlow | undefined {
        if (session) {
            return session[storageKey] as TosFlow | undefined;
        }
    }
    //@ts-ignore
    export async function attach(session: Express.Session, tosFlowInfo: TosFlow): Promise<void> {
        session[storageKey] = tosFlowInfo;
        return saveSession(session);
    }
    //@ts-ignore
    export async function clear(session: Express.Session | undefined) {
        if (session) {
            session[storageKey] = undefined;
            return saveSession(session);
        }
    }
}

