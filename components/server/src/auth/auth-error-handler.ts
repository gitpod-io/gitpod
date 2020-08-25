/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";


@injectable()
export class AuthErrorHandler {

    async check(error: any): Promise<AuthErrorHandler.DidHandleResult | undefined> {
        // no-op
        return undefined;
    }
}

export namespace AuthErrorHandler {
    export interface DidHandleResult {
        redirectToUrl: string;
    }
}