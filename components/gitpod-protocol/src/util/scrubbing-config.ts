/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// redactedFields are the names of fields we'll redact when matched
export const redactedFields = ["auth_", "password", "token", "key", "jwt", "secret", "email"];
// hashedFields are the names of fields we'll hash if matched
export const hashedFields = ["contextURL", "workspaceID", "username"];

// hashedValues are regular expressions which when matched cause the entire value to be hashed
export const hashedValues = new Map<string, RegExp>([]);
// redactedValues are regular expressions which when matched cause the entire value to be redacted
export const redactedValues = new Map<string, RegExp>([
    // https://html.spec.whatwg.org/multipage/input.html#email-state-(type=email)
    [
        "email",
        new RegExp(
            /[a-zA-Z0-9.!#$%&'*+/=?^_\`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/,
            "g",
        ),
    ],
]);
