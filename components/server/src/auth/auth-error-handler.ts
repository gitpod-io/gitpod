/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { Env } from "../env";
import { TosNotAcceptedYetException } from "./errors";


@injectable()
export class AuthErrorHandler {
    @inject(Env) protected readonly env: Env;

    async check(error: any): Promise<AuthErrorHandler.DidHandleResult | undefined> {
        if (TosNotAcceptedYetException.is(error)) {
            const { identity } = error;

            const redirectToUrl = this.env.hostUrl.withApi({ pathname: '/tos' }).toString();
            return <AuthErrorHandler.DidHandleResult>{
                redirectToUrl,
                identity
            }
        }
        return undefined;
    }
}

export namespace AuthErrorHandler {
    export interface DidHandleResult {
        readonly redirectToUrl: string;
    }
}