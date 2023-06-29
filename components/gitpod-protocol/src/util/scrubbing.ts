/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { createHash } from "crypto";
import { hashedFields, hashedValues, redactedFields, redactedValues } from "./scrubbing-config";

/**
 * `TrustedValue` is a generic wrapper class used to mark certain values as "trusted".
 * This means these values are safe from being scrubbed or redacted by the Scrubber interface.
 * A typical use case is to prepare values for logging or similar uses where data sanitization is required.
 *
 * @see Scrubber to scrub an underlyig value as necessary.
 *
 * @template T - The type of the value being wrapped.
 * @property value - The value being wrapped.
 */
export class TrustedValue<T = any> {
    constructor(readonly value: T) {}
}

/**
 * The `Scrubber` interface defines methods for scrubbing or anonymizing data.
 * It helps in preparing data by sanitizing it and ensuring that sensitive information is either hashed or redacted.
 * The scrubbing operation does not mutate the original data structure but creates a new one with the scrubbed data.
 */
export interface Scrubber {
    /**
     * Scrub an entire object, potentially recursively if `nested` is true.
     *
     * @param {any} obj - The object to be scrubbed. This object is not mutated.
     * @param {boolean} [nested] - A flag indicating whether nested scrubbing should be performed. Defaults to true.
     * @returns {any} - The scrubbed object. This is a new object, not a mutation of the original.
     */
    scrub(obj: any, nested?: boolean): any;

    /**
     * Takes a key-value pair and returns a scrubbed version of the value
     * if the key matches any of the defined sensitive fields.
     *
     * @param {string} key - The key of the data to be scrubbed.
     * @param {string} value - The value of the data to be scrubbed.
     * @returns {string} - The scrubbed value. The original value is not mutated.
     */
    scrubKeyValue(key: string, value: string): string;

    /**
     * Takes a value and scrubs it based on defined sensitive patterns.
     *
     * @param {string} value - The value to be scrubbed.
     * @returns {string} - The scrubbed value. The original value is not mutated.
     */
    scrubValue(value: string): string;
}

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

export const scrubber: Scrubber = {
    scrub: function (obj: any, nested: boolean = true): any {
        return doScrub(obj, 0, nested);
    },
    scrubKeyValue: function (key: string, value: string): string {
        for (const [regex, sanitisatiser] of regexes) {
            if (regex.test(key)) {
                return sanitisatiser(value);
            }
        }
        return value;
    },
    scrubValue: function (value: string): string {
        for (const [key, expr] of hashedValues.entries()) {
            value = value.replace(expr, (s) => SanitiseHash(s, { key }));
        }
        for (const [key, expr] of redactedValues.entries()) {
            value = value.replace(expr, (s) => SanitiseRedact(s, { key }));
        }
        return value;
    },
};

function doScrub(obj: any, depth: number, nested: boolean): any {
    if (obj === undefined || obj === null) {
        return undefined;
    }
    if (obj instanceof TrustedValue) {
        return obj.value;
    }
    const objType = typeof obj;
    if (objType === "string") {
        return scrubber.scrubValue(obj);
    }
    if (objType === "boolean" || objType === "number") {
        return obj;
    }
    if (Array.isArray(obj)) {
        if (!nested && depth > 0) {
            return "[redacted:nested:array]";
        }
        return obj.map((v) => doScrub(v, depth + 1, nested));
    }
    if (!nested && depth > 0) {
        return `[redacted:nested:${objType}}]`;
    }
    if (objType === "object") {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === "string") {
                result[key] = scrubber.scrubKeyValue(key, value);
            } else {
                result[key] = doScrub(value, depth + 1, nested);
            }
        }
        return result;
    }
    return obj;
}
