/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/**
 * Skips a Mocha TestSuite if a certain env var is not set or empty
 * @param name The name of the env var the TestSuite depends on being present
 */
export function ifEnvVarNotSet(name: string): boolean {
    const value = process.env[name];
    const skip = value === undefined || value === "";
    if (skip) {
        console.log(`Skipping suite because env var '${name}' is not set or empty`);
    }
    return skip;
}
