/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { scrubber } from "../util/scrubbing";

export class ApplicationError extends Error {
    constructor(public readonly code: ErrorCode, message: string, public readonly data?: any) {
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
        return e && e.code !== undefined;
    }
}

export namespace ErrorCode {
    export function isUserError(code: number | ErrorCode) {
        return code >= 400 && code < 500;
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

    // 440 Prebuilds now always require a project (custom status code)
    PROJECT_REQUIRED: 440 as const,

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

    // 490 Too Many Running Workspace
    TOO_MANY_RUNNING_WORKSPACES: 490 as const,

    // 500 Internal Server Error
    INTERNAL_SERVER_ERROR: 500 as const,

    // 501 EE Feature
    EE_FEATURE: 501 as const,

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
