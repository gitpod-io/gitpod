/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/**
 * a simply cleaning method, that removes all non numbers and repaces a leading '00' with a leading '+' sign.
 *
 * @param phoneNumber
 * @returns formatted phone number
 */
export function formatPhoneNumber(phoneNumber: string): string {
    let cleanPhoneNumber = phoneNumber.trim();
    if (cleanPhoneNumber.startsWith("+")) {
        cleanPhoneNumber = `00${cleanPhoneNumber.substring(1)}`;
    }
    cleanPhoneNumber = cleanPhoneNumber.replace(/\D/g, "");
    if (cleanPhoneNumber.startsWith("00")) {
        cleanPhoneNumber = `+${cleanPhoneNumber.substring(2)}`;
    }
    return cleanPhoneNumber;
}
