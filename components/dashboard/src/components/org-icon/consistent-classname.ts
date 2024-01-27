/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// Represents the max value our base16 guid can be, 32 "f"s
const GUID_MAX = "".padEnd(32, "f");

export const BG_CLASSES = [
    "bg-gradient-1",
    "bg-gradient-2",
    "bg-gradient-3",
    "bg-gradient-4",
    "bg-gradient-5",
    "bg-gradient-6",
    "bg-gradient-7",
    "bg-gradient-8",
    "bg-gradient-9",
];

export const consistentClassname = (id: string) => {
    // Turn id into a 32 char. guid, pad with "0" if it's not 32 chars already
    const guid = id.replaceAll("-", "").substring(0, 32).padEnd(32, "0");

    // Map guid into a 0,1 range by dividing by the max guid
    var quotient = parseInt(guid, 16) / parseInt(GUID_MAX, 16);
    var idx = Math.floor(quotient * (BG_CLASSES.length - 1));

    return BG_CLASSES[idx];
};
