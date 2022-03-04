/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */



export namespace ErrorCodes {
    // 401 Unauthorized
    export const NOT_AUTHENTICATED = 401;

    // 402 Payment Required
    export const NOT_ENOUGH_CREDIT = 402;

    // 403 Forbidden
    export const PERMISSION_DENIED = 403;

    // 404 Not Found
    export const NOT_FOUND = 404;

    // 409 Conflict (e.g. already existing)
    export const CONFLICT = 409;

    // 410 No User
    export const SETUP_REQUIRED = 410;

    // 429 Too Many Requests
    export const TOO_MANY_REQUESTS = 429;

    // 430 Repository not whitelisted (custom status code)
    export const REPOSITORY_NOT_WHITELISTED = 430;

    // 460 Context Parse Error (custom status code)
    export const CONTEXT_PARSE_ERROR = 460;

    // 461 Invalid gitpod yml
    export const INVALID_GITPOD_YML = 461;

    // 450 Payment error
    export const PAYMENT_ERROR = 450;

    // 470 User Blocked (custom status code)
    export const USER_BLOCKED = 470;

    // 471 User Deleted (custom status code)
    export const USER_DELETED = 471;

    // 472 Terms Acceptance Required (custom status code)
    export const USER_TERMS_ACCEPTANCE_REQUIRED = 472;

    // 480 Plan does not allow private repos
    export const PLAN_DOES_NOT_ALLOW_PRIVATE_REPOS = 480;

    // 481 Professional plan is required for this operation
    export const PLAN_PROFESSIONAL_REQUIRED = 481;

    // 485 Plan is only allowed for students
    export const PLAN_ONLY_ALLOWED_FOR_STUDENTS = 485;

    // 490 Too Many Running Workspace
    export const TOO_MANY_RUNNING_WORKSPACES = 490;

    // 501 EE Feature
    export const EE_FEATURE = 501;

    // 555 EE License Required
    export const EE_LICENSE_REQUIRED = 555;

    // 601 SaaS Feature
    export const SAAS_FEATURE = 601;

    // 610 Invalid Team Subscription Quantity
    export const TEAM_SUBSCRIPTION_INVALID_QUANTITY = 610;

    // 620 Team Subscription Assignment Failed
    export const TEAM_SUBSCRIPTION_ASSIGNMENT_FAILED = 620;

    // 630 Snapshot Error
    export const SNAPSHOT_ERROR = 630;

    // 640 Headless logs are not available (yet)
    export const HEADLESS_LOG_NOT_YET_AVAILABLE = 640;
}