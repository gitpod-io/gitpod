/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PlainMessage } from "@bufbuild/protobuf";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import {
    InvalidGitpodYMLError as InvalidGitpodYMLErrorData,
    RepositoryNotFoundError as RepositoryNotFoundErrorData,
    RepositoryUnauthorizedError as RepositoryUnauthorizedErrorData,
} from "@gitpod/public-api/lib/gitpod/v1/error_pb";

export class RepositoryNotFoundError extends ApplicationError {
    constructor(readonly info: PlainMessage<RepositoryNotFoundErrorData>) {
        // on gRPC we remap to PRECONDITION_FAILED, all error code for backwards compatibility with the dashboard
        super(ErrorCodes.NOT_FOUND, "Repository not found.", info);
    }
}
export class UnauthorizedRepositoryAccessError extends ApplicationError {
    constructor(readonly info: PlainMessage<RepositoryUnauthorizedErrorData>) {
        // on gRPC we remap to PRECONDITION_FAILED, all error code for backwards compatibility with the dashboard
        super(ErrorCodes.NOT_AUTHENTICATED, "Repository unauthorized.", info);
    }
}
export class InvalidGitpodYMLError extends ApplicationError {
    constructor(readonly info: PlainMessage<InvalidGitpodYMLErrorData>) {
        // on gRPC we remap to PRECONDITION_FAILED, all error code for backwards compatibility with the dashboard
        super(ErrorCodes.INVALID_GITPOD_YML, "Invalid gitpod.yml: " + info.violations.join(","), info);
    }
}
