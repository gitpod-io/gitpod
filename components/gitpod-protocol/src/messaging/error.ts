/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { scrubber } from "../util/scrubbing";

export class ApplicationError extends Error {
    constructor(readonly code: ErrorCode, readonly message: string, readonly data?: any) {
        super(message);
        this.data = scrubber.scrub(this.data, true);
    }

    toJson() {
        return {
            code: this.code,
            message: this.message,
            data: this.data,
        };
    }
}

export namespace ApplicationError {
    export function hasErrorCode(e: any): e is Error & { code: ErrorCode; data?: any } {
        return ErrorCode.is(e["code"]);
    }

    export async function notFoundToUndefined<T>(p: Promise<T>): Promise<T | undefined> {
        try {
            return await p;
        } catch (e) {
            if (hasErrorCode(e) && e.code === ErrorCodes.NOT_FOUND) {
                return undefined;
            }
            throw e;
        }
    }
}

export namespace ErrorCode {
    export function isUserError(code: number | ErrorCode) {
        return code >= 400 && code < 500;
    }
    export function is(code: any): code is ErrorCode {
        if (typeof code !== "number") {
            return false;
        }
        return Object.values(ErrorCodes).includes(code as ErrorCode);
    }
}

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export const ErrorCodes = {
    // 400 Unauthorized
    BAD_REQUEST: 400 as const,

    // 401 Unauthorized
    NOT_AUTHENTICATED: 401 as const,

    // 403 Forbidden
    PERMISSION_DENIED: 403 as const,

    // 404 Not Found
    NOT_FOUND: 404 as const,

    // 409 Conflict (e.g. already existing)
    CONFLICT: 409 as const,

    // 411 No User
    NEEDS_VERIFICATION: 411 as const,

    // 412 Precondition Failed
    PRECONDITION_FAILED: 412 as const,

    // 429 Too Many Requests
    TOO_MANY_REQUESTS: 429 as const,

    // 430 Repository not whitelisted (custom status code)
    REPOSITORY_NOT_WHITELISTED: 430 as const,

    // 451 Out of credits
    PAYMENT_SPENDING_LIMIT_REACHED: 451 as const,

    // 451 Error creating a subscription
    SUBSCRIPTION_ERROR: 452 as const,

    // 455 Invalid cost center (custom status code)
    INVALID_COST_CENTER: 455 as const,

    // 460 Context Parse Error (custom status code)
    CONTEXT_PARSE_ERROR: 460 as const,

    // 461 Invalid gitpod yml (custom status code)
    INVALID_GITPOD_YML: 461 as const,

    // 470 User Blocked (custom status code)
    USER_BLOCKED: 470 as const,

    // 471 User Deleted (custom status code)
    USER_DELETED: 471 as const,

    // 472 Terms Acceptance Required (custom status code)
    USER_TERMS_ACCEPTANCE_REQUIRED: 472 as const,

    // 481 Professional plan is required for this operation
    PLAN_PROFESSIONAL_REQUIRED: 481 as const,

    // 482 Cell Expired
    CELL_EXPIRED: 482 as const,

    // 490 Too Many Running Workspace
    TOO_MANY_RUNNING_WORKSPACES: 490 as const,

    // 498 The operation was cancelled, typically by the caller.
    CANCELLED: 498 as const,

    // 4981 The deadline expired before the operation could complete.
    DEADLINE_EXCEEDED: 4981 as const,

    // 500 Internal Server Error
    INTERNAL_SERVER_ERROR: 500 as const,

    // 501 EE Feature
    EE_FEATURE: 501 as const,

    // 521 Unimplemented
    UNIMPLEMENTED: 521 as const,

    // 555 EE License Required
    EE_LICENSE_REQUIRED: 555 as const,

    // 601 SaaS Feature
    SAAS_FEATURE: 601 as const,

    // 630 Snapshot Error
    SNAPSHOT_ERROR: 630 as const,

    // 640 Headless logs are not available (yet)
    HEADLESS_LOG_NOT_YET_AVAILABLE: 640 as const,

    // 650 Invalid Value
    INVALID_VALUE: 650 as const,
};
