/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PlainMessage, Timestamp } from "@bufbuild/protobuf";

export namespace PlainTimestamp {
    export function toTimestamp(plainTimestamp: undefined): undefined;
    export function toTimestamp(plainTimestamp: PlainMessage<Timestamp>): Timestamp;
    export function toTimestamp(plainTimestamp: PlainMessage<Timestamp> | undefined): Timestamp | undefined;
    export function toTimestamp(plainTimestamp: PlainMessage<Timestamp> | undefined): Timestamp | undefined {
        if (!plainTimestamp) {
            return undefined;
        }
        const timestamp = new Timestamp();
        timestamp.nanos = plainTimestamp.nanos;
        timestamp.seconds = plainTimestamp.seconds;
        return timestamp;
    }
    export function toDate(plainTimestamp: undefined): undefined;
    export function toDate(plainTimestamp: PlainMessage<Timestamp>): Date;
    export function toDate(plainTimestamp: PlainMessage<Timestamp> | undefined): Date | undefined;
    export function toDate(plainTimestamp: PlainMessage<Timestamp> | undefined): Date | undefined {
        return toTimestamp(plainTimestamp)?.toDate();
    }
}
