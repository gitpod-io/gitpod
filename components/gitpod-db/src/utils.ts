/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export function filter(
    obj: { [key: string]: any },
    predicate: (key: string, value: any) => boolean,
): { [key: string]: any } {
    const result = Object.create(null);
    for (const [key, value] of Object.entries(obj)) {
        if (predicate(key, value)) {
            result[key] = value;
        }
    }
    return result;
}
