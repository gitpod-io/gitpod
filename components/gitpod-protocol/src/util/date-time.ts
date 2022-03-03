/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export function formatDate(date?: string) {
    return date ? new Date(date).toLocaleString() : '';
}

export function formatHours(hours?: number) {
    if (hours === undefined) {
        return '';
    }
    const h = Math.floor(Math.abs(hours));
    const rm = (Math.abs(hours) - h) * 60;
    const m = Math.floor(rm);
    const rs = (rm - m) * 60;
    const s = Math.floor(rs);
    const result = h + ':' + pad2(m) + ':' + pad2(s);
    if (hours < 0) {
        return `-${result}`;
    } else {
        return `${result}`;
    }
}

function pad2(n: number) {
    return n < 10 ? '0' + n : '' + n;
}
