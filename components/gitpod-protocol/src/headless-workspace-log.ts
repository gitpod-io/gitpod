/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export interface HeadlessLogUrls {
    // A map of id to URL
    streams: { [streamID: string]: string };
}

/** cmp. @const HEADLESS_LOG_STREAM_STATUS_CODE_REGEX */
export const HEADLESS_LOG_STREAM_STATUS_CODE = "X-LogStream-StatusCode";
export const HEADLESS_LOG_STREAM_STATUS_CODE_REGEX = /X-LogStream-StatusCode: ([0-9]{3})/;