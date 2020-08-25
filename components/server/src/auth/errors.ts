/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Identity } from "@gitpod/gitpod-protocol";

export interface TosNotAcceptedYetException extends Error {
    readonly identity: Identity;
}
export namespace TosNotAcceptedYetException {
    export function create(identity: Identity) {
        return Object.assign(new Error("TosNotAcceptedYetException"), { identity });
    }
    export function is(error: Error | null): error is TosNotAcceptedYetException {
        return !!error && error.message === 'TosNotAcceptedYetException';
    }
}

export interface AuthException extends Error {
    readonly payload: any;
    readonly authException: string;
}
export namespace AuthException {
    export function create(authException: string, message: string, payload: any) {
        return Object.assign(new Error(message), { payload, authException });
    }
    export function is(error: any): error is AuthException {
        return error && "authException" in error;
    }
}

export interface EMailDomainFilterException extends AuthException { }
export namespace EMailDomainFilterException {
    const type = "EMailDomainFilterException";
    const message = "We do not allow disposable email addresses.";
    export function create(email: string) {
        return AuthException.create(type, message, email);
    }
    export function is(error: any): error is EMailDomainFilterException {
        return AuthException.is(error) && error.authException === type;
    }
}

export interface UnconfirmedUserException extends AuthException { }
export namespace UnconfirmedUserException {
    const type = "UnconfirmedUserException";
    export function create(message: string, payload: any) {
        return AuthException.create(type, message, payload);
    }
    export function is(error: any): error is UnconfirmedUserException {
        return AuthException.is(error) && error.authException === type;
    }
}
