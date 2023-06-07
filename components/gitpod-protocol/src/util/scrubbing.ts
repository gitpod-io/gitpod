/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { createHash } from "crypto";

const redactedFields = ["auth_", "password", "token", "key", "jwt", "secret"];
const hashedFields = ["contextURL", "workspaceID", "username", "email"];

const hashedValues = new Map<string, RegExp>([
    // https://html.spec.whatwg.org/multipage/input.html#email-state-(type=email)
    [
        "email",
        new RegExp(
            /[a-zA-Z0-9.!#$%&'*+/=?^_\`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/,
            "g",
        ),
    ],
]);

interface SanitizeOptions {
    key?: string;
}
type Sanitisatiser = (value: string, options?: SanitizeOptions) => string;

const SanitiseRedact: Sanitisatiser = (_: string, options?: SanitizeOptions) => {
    if (options?.key) {
        return `[redacted:${options?.key}]`;
    }
    return "[redacted]";
};
const SanitiseHash: Sanitisatiser = (value: string, options?: SanitizeOptions) => {
    const hash = createHash("md5");
    hash.update(value);

    let res = `[redacted:md5:${hash.digest("hex")}`;
    if (options?.key) {
        res += `:${options?.key}`;
    }
    res += `]`;
    return res;
};

const regexes = new Map<RegExp, Sanitisatiser>([
    [new RegExp(redactedFields.join("|"), "i"), SanitiseRedact],
    [new RegExp(hashedFields.join("|"), "i"), SanitiseHash],
]);

export function scrubKeyValue(key: string, value: string): string {
    for (const [regex, sanitisatiser] of regexes) {
        if (regex.test(key)) {
            return sanitisatiser(value);
        }
    }
    return value;
}

export function scrubValue(value: string): string {
    for (const [key, expr] of hashedValues.entries()) {
        value = value.replace(expr, (s) => SanitiseHash(s, { key }));
    }
    return value;
}

export const scrubReplacer = (key: string, value: any): any => {
    if (typeof value === "object" && value !== null) {
        // https://github.com/gitpod-io/security/issues/64
        const k = value["name"];
        const v = value["value"];
        if (k != "" && v != "") {
            const scrubbedValue = scrubKeyValue(k, v);
            if (scrubbedValue != v) {
                return {
                    ...value,
                    value: scrubbedValue,
                };
            }
        }
    }
    if (typeof value === "string") {
        if (key == "" || !isNaN(Number(key))) {
            return scrubValue(value);
        }
        return scrubKeyValue(key, value);
    }
    return value;
};
