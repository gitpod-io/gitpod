/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


export enum HeadlessWorkspaceEventType {
    LogOutput = "log-output",
    FinishedSuccessfully = "finish-success",
    FinishedButFailed = "finish-fail",
    AbortedTimedOut = "aborted-timeout",
    Aborted = "aborted",
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

export interface HeadlessLogEvent {
    workspaceID: string;
    text: string;
    type: HeadlessWorkspaceEventType;
}

export enum TheiaHeadlessLogType {
    TaskLogLabel = "workspaceTaskOutput",
    TaskFailedLabel = "workspaceTaskFailed",
    TaskSuccessfulLabel = "workspaceTaskDone"
}

export interface TheiaHeadlessLogMessage {
    type: TheiaHeadlessLogType;
    data?: string;
    error?: string;
    snapshotURL?: string;
}
