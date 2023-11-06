/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PlainMessage } from "@bufbuild/protobuf";
import { ConnectError, Code } from "@connectrpc/connect";
import {
    ErrorInfo,
    ErrorInfo_Reason,
    ResourceInfo,
    ResourceInfo_Type,
} from "@gitpod/public-api/lib/gitpod/v1/error_pb";
import { scrubber } from "../util/scrubbing";
import { Status } from "nice-grpc-common";

/**
 * @deprecated use subclasses of ConnectAwareApplicationError instead
 */
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

export abstract class ConnectAwareApplicationError extends ApplicationError {
    abstract toConnectError(): ConnectError;
}

export class NotFoundError extends ConnectAwareApplicationError {
    constructor(private readonly info: PlainMessage<ResourceInfo>) {
        super(ErrorCodes.NOT_FOUND, NotFoundError.toMessage(info));
    }

    toConnectError(): ConnectError {
        return new ConnectError(
            this.message,
            Code.NotFound,
            undefined,
            [Object.assign(new ResourceInfo(), this.info)],
            undefined,
        );
    }

    private static toMessage(info: PlainMessage<ResourceInfo>): string {
        switch (info.type) {
            case ResourceInfo_Type.USER:
                return `User ${info.id} not found`;
            case ResourceInfo_Type.ORGANIZATION:
                return `Organization ${info.id} not found`;
            case ResourceInfo_Type.CONFIGURATION:
                return `Configuration ${info.id} not found`;
            case ResourceInfo_Type.WORKSPACE:
                return `Workspace ${info.id} not found`;
            case ResourceInfo_Type.ORGANIZATION_INVITE:
                return "The invite link is no longer valid.";
            case ResourceInfo_Type.ORGANIZATION_MEMBER:
                return `Could not find membership for user ${info.id} in organization ${info.parentId}`;
        }
        throw new Error(`Unexpected resource type: ${info.type}`);
    }
}
export class AlreadyExistsError extends ConnectAwareApplicationError {
    constructor(private readonly info: PlainMessage<ResourceInfo>) {
        super(ErrorCodes.CONFLICT, AlreadyExistsError.toMessage(info));
    }

    toConnectError(): ConnectError {
        return new ConnectError(
            this.message,
            Code.AlreadyExists,
            undefined,
            [Object.assign(new ResourceInfo(), this.info)],
            undefined,
        );
    }

    private static toMessage(info: PlainMessage<ResourceInfo>): string {
        switch (info.type) {
            case ResourceInfo_Type.USER:
                return `User ${info.id} already exists`;
            case ResourceInfo_Type.ORGANIZATION:
                return `Organization ${info.id} already exists`;
            case ResourceInfo_Type.CONFIGURATION:
                return `Configuration ${info.id} already exists`;
            case ResourceInfo_Type.WORKSPACE:
                return `Workspace ${info.id} already exists`;
        }
        throw new Error(`Unexpected resource type: ${info.type}`);
    }
}

function toReasonMessage(info: Pick<ErrorInfo, "reason"> & Pick<Partial<ErrorInfo>, "metadata">): string {
    switch (info.reason) {
        case ErrorInfo_Reason.INVITES_DISABLED_SSO_ORGANIZATION:
            return "Invites are disabled for SSO organizations.";
        case ErrorInfo_Reason.LAST_ORGANIZATION_OWNER_CANNOT_BE_REMOVED:
            return "The last organization owner cannot be removed.";
        case ErrorInfo_Reason.MEMBER_BELONGS_TO_ORGANIZATION:
            const memberId = info.metadata?.memberId;
            const organizationId = info.metadata?.organizationId;
            return `User's account '${memberId}' belongs to the organization '${organizationId}'`;
    }
    throw new Error(`Unknown reason: ${info.reason}`);
}

export class FailedPreconditionError extends ConnectAwareApplicationError {
    constructor(private readonly info: Pick<ErrorInfo, "reason"> & Pick<Partial<ErrorInfo>, "metadata">) {
        super(ErrorCodes.PRECONDITION_FAILED, toReasonMessage(info));
    }

    toConnectError(): ConnectError {
        return new ConnectError(
            this.message,
            Code.FailedPrecondition,
            undefined,
            [Object.assign(new ErrorInfo(), this.info)],
            undefined,
        );
    }
}

export class InternalError extends ConnectAwareApplicationError {
    constructor(message: string, private readonly cause: unknown) {
        super(ErrorCodes.INTERNAL_SERVER_ERROR, message);
    }

    toConnectError(): ConnectError {
        return new ConnectError(this.message, Code.Internal, undefined, undefined, this.cause);
    }
}

export namespace ApplicationError {
    export function hasErrorCode(e: any): e is Error & { code: ErrorCode; data?: any } {
        return e && e.code !== undefined;
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

    export function fromGRPCError(e: any, data?: any): ApplicationError {
        // Argument e should be ServerErrorResponse
        // But to reduce dependency requirement, we use Error here

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return new ApplicationError(categorizeRPCError(e.code), e.message, data);
    }

    export function categorizeRPCError(code?: Status): ErrorCode {
        // Mostly align to https://github.com/gitpod-io/gitpod/blob/ef95e6f3ca0bf314c40da1b83251423c2208d175/components/public-api-server/pkg/proxy/errors.go#L25
        switch (code) {
            case Status.INVALID_ARGUMENT:
                return ErrorCodes.BAD_REQUEST;
            case Status.UNAUTHENTICATED:
                return ErrorCodes.NOT_AUTHENTICATED;
            case Status.PERMISSION_DENIED:
                return ErrorCodes.PERMISSION_DENIED; // or UserBlocked
            case Status.NOT_FOUND:
                return ErrorCodes.NOT_FOUND;
            case Status.ALREADY_EXISTS:
                return ErrorCodes.CONFLICT;
            case Status.FAILED_PRECONDITION:
                return ErrorCodes.PRECONDITION_FAILED;
            case Status.RESOURCE_EXHAUSTED:
                return ErrorCodes.TOO_MANY_REQUESTS;
        }
        return ErrorCodes.INTERNAL_SERVER_ERROR;
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
