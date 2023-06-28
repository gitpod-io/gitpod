/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { inject, injectable } from "inversify";

import { OrganizationPermission, objectRef, subject } from "./definitions";
import { SpiceDBAuthorizer } from "./spicedb-authorizer";

export type CheckResult = {
    permitted: boolean;
    err?: Error;
    response?: v1.CheckPermissionResponse;
};

export const NotPermitted = { permitted: false };

@injectable()
export class AuthPermissions {
    constructor(
        @inject(SpiceDBAuthorizer)
        private authorizer: SpiceDBAuthorizer,
    ) {}

    async hasPermissionOnOrg(userId: string, permission: OrganizationPermission, orgId: string): Promise<boolean> {
        const req = v1.CheckPermissionRequest.create({
            subject: subject("user", userId),
            permission,
            resource: objectRef("organization", orgId),
            consistency: v1.Consistency.create({
                requirement: {
                    oneofKind: "fullyConsistent",
                    fullyConsistent: true,
                },
            }),
        });

        return this.authorizer.check(req, { userID: userId, orgID: orgId });
    }
}
