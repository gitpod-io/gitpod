/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ApplicationError, ErrorCode, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

/**
 * new entry for the stream prebuild logs, contains logs of imageBuild (if it has) and prebuild tasks(first task only for now) logs
 * will be respond by public api gitpod.v1 PrebuildService.GetPrebuildLogUrl
 */
export const PREBUILD_LOGS_PATH_PREFIX = "/prebuild-logs";

export function getPrebuildLogPath(prebuildId: string, taskId?: string): string {
    const result = PREBUILD_LOGS_PATH_PREFIX + "/" + prebuildId;
    if (taskId) {
        return result + "/" + taskId;
    }
    return result;
}

/** cmp. @const HEADLESS_LOG_STREAM_ERROR_REGEX */
const PREBUILD_LOG_STREAM_ERROR = "X-Prebuild-Error";
const PREBUILD_LOG_STREAM_ERROR_REGEX = /X-Prebuild-Error#(?<code>[0-9]+)#(?<message>.*?)#X-Prebuild-Error/;

export function matchPrebuildError(msg: string): undefined | ApplicationError {
    const result = PREBUILD_LOG_STREAM_ERROR_REGEX.exec(msg);
    if (!result || !result.groups) {
        return;
    }
    return new ApplicationError(Number(result.groups.code) as ErrorCode, result.groups.message);
}

export function getPrebuildErrorMessage(err: any) {
    let code: ErrorCode = ErrorCodes.INTERNAL_SERVER_ERROR;
    let message = "unknown error";
    if (err instanceof ApplicationError) {
        code = err.code;
        message = err.message;
    } else if (err instanceof Error) {
        message = "unexpected error";
    }
    return `${PREBUILD_LOG_STREAM_ERROR}#${code}#${message}#${PREBUILD_LOG_STREAM_ERROR}`;
}
