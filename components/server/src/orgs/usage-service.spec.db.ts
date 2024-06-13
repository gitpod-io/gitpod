/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { BUILTIN_INSTLLATION_ADMIN_USER_ID, TypeORM } from "@gitpod/gitpod-db/lib";
import { Organization, User } from "@gitpod/gitpod-protocol";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { ListUsageRequest, Ordering } from "@gitpod/gitpod-protocol/lib/usage";
import {
    CostCenter_BillingStrategy,
    GetCostCenterRequest,
    UsageServiceClient,
    UsageServiceDefinition,
} from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { Mock } from "../test/mocks/mock";
import { createTestContainer, withTestCtx } from "../test/service-testing-container-module";
import { OrganizationService } from "./organization-service";
import { UsageService } from "./usage-service";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import { expectError } from "../test/expect-utils";
import { UserService } from "../user/user-service";
import { SYSTEM_USER } from "../authorization/authorizer";

const expect = chai.expect;

describe("UsageService", async () => {
    let container: Container;
    let os: OrganizationService;
    let us: UsageService;

    let owner: User;
    let member: User;
    let stranger: User;
    let admin: User;
    let org: Organization;
    let usageServiceMock: Mock<UsageServiceClient> & UsageServiceClient;

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({});
        os = container.get(OrganizationService);
        const userService = container.get<UserService>(UserService);
        owner = await userService.createUser({
            identity: {
                authName: "github",
                authProviderId: "github",
                authId: "1234",
            },
        });
        org = await os.createOrganization(owner.id, "myorg");
        const invite = await os.getOrCreateInvite(owner.id, org.id);

        member = await userService.createUser({
            identity: {
                authName: "github",
                authProviderId: "github",
                authId: "1234",
            },
        });
        await withTestCtx(SYSTEM_USER, () => os.joinOrganization(member.id, invite.id));

        stranger = await userService.createUser({
            identity: {
                authName: "github",
                authProviderId: "github",
                authId: "1234",
            },
        });

        admin = await userService.createUser({
            identity: {
                authName: "github",
                authProviderId: "github",
                authId: "1234",
            },
        });
        await userService.updateRoleOrPermission(BUILTIN_INSTLLATION_ADMIN_USER_ID, admin.id, [
            {
                role: "admin",
                add: true,
            },
        ]);

        us = container.get<UsageService>(UsageService);
        await us.getCostCenter(owner.id, org.id);
        usageServiceMock = container.get(UsageServiceDefinition.name);
    });

    afterEach(async () => {
        // Clean-up database
        const typeorm = container.get(TypeORM);
        await resetDB(typeorm);
        // Deactivate all services
        await container.unbindAllAsync();
    });

    it("getCostCenter permissions", async () => {
        expect(await us.getCostCenter(member.id, org.id)).to.not.be.undefined;
        expect(await us.getCostCenter(owner.id, org.id)).to.not.be.undefined;
        expect(await us.getCostCenter(admin.id, org.id)).to.not.be.undefined;
        await expectError(ErrorCodes.NOT_FOUND, us.getCostCenter(stranger.id, org.id));
    });

    it("setUsageLimit permissions", async () => {
        await usageServiceMock.setCostCenter({
            costCenter: {
                attributionId: AttributionId.render(AttributionId.createFromOrganizationId(org.id)),
                billingStrategy: CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE,
            },
        });
        await us.setUsageLimit(admin.id, org.id, 200);
        await us.setUsageLimit(owner.id, org.id, 200);
        await expectError(ErrorCodes.PERMISSION_DENIED, us.setUsageLimit(member.id, org.id, 200));
        await expectError(ErrorCodes.NOT_FOUND, us.setUsageLimit(stranger.id, org.id, 200));

        await usageServiceMock.setCostCenter({
            costCenter: {
                attributionId: AttributionId.render(AttributionId.createFromOrganizationId(org.id)),
                billingStrategy: CostCenter_BillingStrategy.BILLING_STRATEGY_OTHER,
            },
        });
        await us.setUsageLimit(admin.id, org.id, 200);
        await expectError(ErrorCodes.PERMISSION_DENIED, us.setUsageLimit(owner.id, org.id, 200));
        await expectError(ErrorCodes.PERMISSION_DENIED, us.setUsageLimit(member.id, org.id, 200));
        await expectError(ErrorCodes.NOT_FOUND, us.setUsageLimit(stranger.id, org.id, 200));
    });

    it("listUsage permissions", async () => {
        const req: ListUsageRequest = {
            attributionId: AttributionId.render(AttributionId.createFromOrganizationId(org.id)),
            from: new Date().getTime(),
            to: new Date().getTime(),
            order: Ordering.ORDERING_ASCENDING,
            pagination: {
                page: 1,
                perPage: 10,
            },
        };
        await us.listUsage(member.id, req);
        await expectError(ErrorCodes.NOT_FOUND, us.listUsage(stranger.id, req));
        await us.listUsage(owner.id, req);
        await us.listUsage(admin.id, req);
    });

    it("getCurrentBalance permissions", async () => {
        await us.getCurrentBalance(member.id, org.id);
        await expectError(ErrorCodes.NOT_FOUND, us.getCurrentBalance(stranger.id, org.id));
        await us.getCurrentBalance(owner.id, org.id);
        await us.getCurrentBalance(admin.id, org.id);
    });

    it("addCreditNote permissions", async () => {
        await expectError(ErrorCodes.PERMISSION_DENIED, () =>
            us.addCreditNote(owner.id, org.id, 100, "some description"),
        );
        await expectError(ErrorCodes.PERMISSION_DENIED, () =>
            us.addCreditNote(member.id, org.id, 100, "some description"),
        );
        await expectError(ErrorCodes.NOT_FOUND, us.addCreditNote(stranger.id, org.id, 100, "some description"));
        await us.addCreditNote(admin.id, org.id, 100, "some description");
    });

    it("checkUsageLimitReached permissions", async () => {
        await us.checkUsageLimitReached(owner.id, org.id);
        await us.checkUsageLimitReached(member.id, org.id);
        await us.checkUsageLimitReached(admin.id, org.id);
        await expectError(ErrorCodes.NOT_FOUND, us.checkUsageLimitReached(stranger.id, org.id));
    });

    it("checkUsageLimitReached logic", async () => {
        await us.setUsageLimit(admin.id, org.id, 100);
        usageServiceMock.override({
            getBalance: async (req: GetCostCenterRequest) => {
                return {
                    credits: 20,
                };
            },
        });
        let limitReached = await us.checkUsageLimitReached(owner.id, org.id);
        expect(limitReached.reached).to.be.false;
        expect(!!limitReached.almostReached).to.be.false;

        usageServiceMock.override({
            getBalance: async (req: GetCostCenterRequest) => {
                return {
                    credits: 90,
                };
            },
        });
        limitReached = await us.checkUsageLimitReached(member.id, org.id);
        expect(limitReached.reached).to.be.false;
        expect(!!limitReached.almostReached).to.be.true;

        usageServiceMock.override({
            getBalance: async (req: GetCostCenterRequest) => {
                return {
                    credits: 120,
                };
            },
        });
        limitReached = await us.checkUsageLimitReached(member.id, org.id);
        expect(limitReached.reached).to.be.true;
        expect(!!limitReached.almostReached).to.be.false;
    });
});
