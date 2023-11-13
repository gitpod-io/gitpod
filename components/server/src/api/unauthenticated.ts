/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

const UNAUTHENTICATED_METADATA_KEY = Symbol("Unauthenticated");

export function Unauthenticated() {
    return Reflect.metadata(UNAUTHENTICATED_METADATA_KEY, true);
}

export namespace Unauthenticated {
    export function get(target: Object, properyKey: string | symbol): boolean {
        return !!Reflect.getMetadata(UNAUTHENTICATED_METADATA_KEY, target, properyKey);
    }
}
