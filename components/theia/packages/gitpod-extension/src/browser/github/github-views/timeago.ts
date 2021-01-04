/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as moment from "moment";

export interface TimeagoProps {
    time: string | number | Date
    now?: string | number | Date
}
export function Timeago(props: TimeagoProps): string {
    const p = {
        now: moment(),
        ...props
    };
    const m = moment(p.time);
    const diff = m.diff(p.now, 'months', true);
    if (Math.abs(diff) <= 1) {
        return m.from(p.now);
    }
    const format = m.format('MMM Do, YYYY');
    return `on ${format}`;
}
