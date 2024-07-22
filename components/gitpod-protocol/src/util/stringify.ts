/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export namespace BigIntToJson {
    export const BIGINT_KEY = "bigint:";
    export function replacer(key: string, value: any) {
        if (typeof value === "bigint") {
            return `${BIGINT_KEY}${value.toString()}`;
        }
        return value;
    }
    export function reviver(key: string, value: any) {
        if (typeof value === "string" && value.startsWith(BIGINT_KEY)) {
            const v: string = value.substring(7);
            return BigInt(v);
        }
        return value;
    }
}
