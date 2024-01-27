// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package protocol

const (

	// 400 Unauthorized
	BAD_REQUEST = 400

	// 401 Unauthorized
	NOT_AUTHENTICATED = 401

	// 403 Forbidden
	PERMISSION_DENIED = 403

	// 404 Not Found
	NOT_FOUND = 404

	// 409 Conflict (e.g. already existing)
	CONFLICT = 409

	// 411 No User
	NEEDS_VERIFICATION = 411

	// 429 Too Many Requests
	TOO_MANY_REQUESTS = 429

	// 430 Repository not whitelisted (custom status code)
	REPOSITORY_NOT_WHITELISTED = 430

	// 451 Out of credits
	PAYMENT_SPENDING_LIMIT_REACHED = 451

	// 451 Error creating a subscription
	SUBSCRIPTION_ERROR = 452

	// 455 Invalid cost center (custom status code)
	INVALID_COST_CENTER = 455

	// 460 Context Parse Error (custom status code)
	CONTEXT_PARSE_ERROR = 460

	// 461 Invalid gitpod yml
	INVALID_GITPOD_YML = 461

	// 470 User Blocked (custom status code)
	USER_BLOCKED = 470

	// 471 User Deleted (custom status code)
	USER_DELETED = 471

	// 472 Terms Acceptance Required (custom status code)
	USER_TERMS_ACCEPTANCE_REQUIRED = 472

	// 481 Professional plan is required for this operation
	PLAN_PROFESSIONAL_REQUIRED = 481

	// 490 Too Many Running Workspace
	TOO_MANY_RUNNING_WORKSPACES = 490

	// 500 Internal Server Error
	INTERNAL_SERVER_ERROR = 500

	// 501 EE Feature
	EE_FEATURE = 501

	// 555 EE License Required
	EE_LICENSE_REQUIRED = 555

	// 601 SaaS Feature
	SAAS_FEATURE = 601

	// 630 Snapshot Error
	SNAPSHOT_ERROR = 630

	// 640 Headless logs are not available (yet)
	HEADLESS_LOG_NOT_YET_AVAILABLE = 640

	// 650 Invalid Value
	INVALID_VALUE = 650
)
