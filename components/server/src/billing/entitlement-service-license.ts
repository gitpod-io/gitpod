/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { UserDB } from "@gitpod/gitpod-db/lib";
import {
    BillingTier,
    User,
    WorkspaceInstance,
    WorkspaceTimeoutDuration,
    WORKSPACE_TIMEOUT_DEFAULT_LONG,
} from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { EntitlementService, MayStartWorkspaceResult } from "./entitlement-service";
import { Config } from "../config";

@injectable()
export class EntitlementServiceLicense implements EntitlementService {
    @inject(Config) protected readonly config: Config;
    @inject(UserDB) protected readonly userDb: UserDB;

    async mayStartWorkspace(
        user: User,
        organizationId: string | undefined,
        date: Date,
        runningInstances: Promise<WorkspaceInstance[]>,
    ): Promise<MayStartWorkspaceResult> {
        // if payment is not enabled users can start as many parallel workspaces as they want
        return {};
    }

    async maySetTimeout(user: User, date: Date): Promise<boolean> {
        // when payment is disabled users can do everything
        return true;
    }

    async getDefaultWorkspaceTimeout(user: User, date: Date): Promise<WorkspaceTimeoutDuration> {
        return WORKSPACE_TIMEOUT_DEFAULT_LONG;
    }

    async userGetsMoreResources(user: User): Promise<boolean> {
        // TODO(gpl) Not sure this makes sense, but it's the way it was before
        return false;
    }

    /**
     * Returns true if network connections should be limited
     * @param user
     */
    async limitNetworkConnections(user: User, date: Date): Promise<boolean> {
        return false;
    }

    async getBillingTier(user: User): Promise<BillingTier> {
        // TODO(gpl) Is this true? Cross-check this whole interface with Self-Hosted before next release!
        return "paid";
    }
}
