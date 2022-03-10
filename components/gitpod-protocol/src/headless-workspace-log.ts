/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


export enum HeadlessWorkspaceEventType {
    LogOutput = "log-output",
    FinishedSuccessfully = "finish-success",
    FinishedButFailed = "finish-fail",
    AbortedTimedOut = "aborted-timeout",
    Aborted = "aborted",
    Failed = "failed",
    Started = "started"
}
export namespace HeadlessWorkspaceEventType {
    export function isRunning(t: HeadlessWorkspaceEventType) {
        return t === HeadlessWorkspaceEventType.LogOutput;
    }
    export function didFinish(t: HeadlessWorkspaceEventType) {
        return t === HeadlessWorkspaceEventType.FinishedButFailed || t === HeadlessWorkspaceEventType.FinishedSuccessfully;
    }
}

export interface HeadlessWorkspaceEvent {
    workspaceID: string;
    text: string;
    type: HeadlessWorkspaceEventType;
}

export interface HeadlessLogUrls {
    // A map of id to URL
    streams: { [streamID: string]: string };
}

/** cmp. @const HEADLESS_LOG_STREAM_STATUS_CODE_REGEX */
export const HEADLESS_LOG_STREAM_STATUS_CODE = "X-LogStream-StatusCode";
export const HEADLESS_LOG_STREAM_STATUS_CODE_REGEX = /X-LogStream-StatusCode: ([0-9]{3})/;