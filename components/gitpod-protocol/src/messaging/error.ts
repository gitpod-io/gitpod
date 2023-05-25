/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export namespace ErrorCodes {
    // 400 Unauthorized
    export const BAD_REQUEST = 400;

    // 401 Unauthorized
    export const NOT_AUTHENTICATED = 401;

    // 403 Forbidden
    export const PERMISSION_DENIED = 403;

    // 404 Not Found
    export const NOT_FOUND = 404;

    // 409 Conflict (e.g. already existing)
    export const CONFLICT = 409;

    // 411 No User
    export const NEEDS_VERIFICATION = 411;

    // 429 Too Many Requests
    export const TOO_MANY_REQUESTS = 429;

    // 430 Repository not whitelisted (custom status code)
    export const REPOSITORY_NOT_WHITELISTED = 430;

    // 440 Prebuilds now always require a project (custom status code)
    export const PROJECT_REQUIRED = 440;

    // 451 Out of credits
    export const PAYMENT_SPENDING_LIMIT_REACHED = 451;

    // 451 Error creating a subscription
    export const SUBSCRIPTION_ERROR = 452;

    // 455 Invalid cost center (custom status code)
    export const INVALID_COST_CENTER = 455;

    // 460 Context Parse Error (custom status code)
    export const CONTEXT_PARSE_ERROR = 460;

    // 461 Invalid gitpod yml (custom status code)
    export const INVALID_GITPOD_YML = 461;

    // 470 User Blocked (custom status code)
    export const USER_BLOCKED = 470;

    // 471 User Deleted (custom status code)
    export const USER_DELETED = 471;

    // 472 Terms Acceptance Required (custom status code)
    export const USER_TERMS_ACCEPTANCE_REQUIRED = 472;

    // 481 Professional plan is required for this operation
    export const PLAN_PROFESSIONAL_REQUIRED = 481;

    // 490 Too Many Running Workspace
    export const TOO_MANY_RUNNING_WORKSPACES = 490;

    // 500 Internal Server Error
    export const INTERNAL_SERVER_ERROR = 500;

    // 501 EE Feature
    export const EE_FEATURE = 501;

    // 555 EE License Required
    export const EE_LICENSE_REQUIRED = 555;

    // 601 SaaS Feature
    export const SAAS_FEATURE = 601;

    // 630 Snapshot Error
    export const SNAPSHOT_ERROR = 630;

    // 640 Headless logs are not available (yet)
    export const HEADLESS_LOG_NOT_YET_AVAILABLE = 640;

    // 650 Invalid Value
    export const INVALID_VALUE = 650;

    export function isUserError(code: number): boolean {
        return code >= 400 && code < 500;
    }
}
