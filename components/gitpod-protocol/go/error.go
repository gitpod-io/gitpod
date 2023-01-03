// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package protocol

const (

	// 400 Unauthorized
	BAD_REQUEST = 400

	// 401 Unauthorized
	NOT_AUTHENTICATED = 401

	// 402 Payment Required
	NOT_ENOUGH_CREDIT = 402

	// 403 Forbidden
	PERMISSION_DENIED = 403

	// 404 Not Found
	NOT_FOUND = 404

	// 409 Conflict (e.g. already existing)
	CONFLICT = 409

	// 410 No User
	SETUP_REQUIRED = 410

	// 429 Too Many Requests
	TOO_MANY_REQUESTS = 429

	// 430 Repository not whitelisted (custom status code)
	REPOSITORY_NOT_WHITELISTED = 430

	// 460 Context Parse Error (custom status code)
	CONTEXT_PARSE_ERROR = 460

	// 461 Invalid gitpod yml
	INVALID_GITPOD_YML = 461

	// 450 Payment error
	PAYMENT_ERROR = 450

	// 470 User Blocked (custom status code)
	USER_BLOCKED = 470

	// 471 User Deleted (custom status code)
	USER_DELETED = 471

	// 472 Terms Acceptance Required (custom status code)
	USER_TERMS_ACCEPTANCE_REQUIRED = 472

	// 480 Plan does not allow private repos
	PLAN_DOES_NOT_ALLOW_PRIVATE_REPOS = 480

	// 481 Professional plan is required for this operation
	PLAN_PROFESSIONAL_REQUIRED = 481

	// 485 Plan is only allowed for students
	PLAN_ONLY_ALLOWED_FOR_STUDENTS = 485

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

	// 610 Invalid Team Subscription Quantity
	TEAM_SUBSCRIPTION_INVALID_QUANTITY = 610

	// 620 Team Subscription Assignment Failed
	TEAM_SUBSCRIPTION_ASSIGNMENT_FAILED = 620

	// 630 Snapshot Error
	SNAPSHOT_ERROR = 630

	// 640 Headless logs are not available (yet)
	HEADLESS_LOG_NOT_YET_AVAILABLE = 640
)
