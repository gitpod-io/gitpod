/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export interface SelectAccountPayload {
    currentUser: {
        name: string;
        avatarUrl: string;
        authHost: string;
        authName: string;
        authProviderType: string;
    };
    otherUser: {
        name: string;
        avatarUrl: string;
        authHost: string;
        authName: string;
        authProviderType: string;
    };
}
export namespace SelectAccountPayload {
    export function is(data: any): data is SelectAccountPayload {
        return typeof data === 'object' && 'currentUser' in data && 'otherUser' in data;
    }
}
