/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TypeORM, UserDB, resetDB } from "@gitpod/gitpod-db/lib";
import { AuditLogDB } from "@gitpod/gitpod-db/lib/audit-log-db";
import { Organization, User } from "@gitpod/gitpod-protocol";
import { expect } from "chai";
import { Container } from "inversify";
import { v4 } from "uuid";
import { OrganizationService } from "../orgs/organization-service";
import { createTestContainer } from "../test/service-testing-container-module";
import { UserService } from "../user/user-service";
import { AuditLogService } from "./AuditLogService";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";

describe("AuditLogService", () => {
    let container: Container;
    let auditLogService: AuditLogService;
    let auditLogDB: AuditLogDB;

    let org: Organization;
    let owner: User;
    let member: User;
    let stranger: User;

    function fromToday(days: number) {
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({
            audit_logs: true,
        });
        auditLogService = container.get(AuditLogService);
        auditLogDB = container.get(AuditLogDB);
        const os = container.get(OrganizationService);
        const userService = container.get<UserService>(UserService);
        const userDb = container.get<UserDB>(UserDB);
        owner = await userService.createUser({
            identity: {
                authId: "github|1234",
                authName: "github",
                authProviderId: "github",
            },
        });
        org = await os.createOrganization(owner.id, "myorg");
        await userDb.updateUserPartial({
            id: owner.id,
            organizationId: org.id,
        });

        member = await userService.createUser({
            identity: {
                authId: "github|1234",
                authName: "github",
                authProviderId: "github",
            },
        });
        await userDb.updateUserPartial({
            id: member.id,
            organizationId: org.id,
        });
        await os.addOrUpdateMember(owner.id, org.id, member.id, "member", { flexibleRole: false });

        stranger = await userService.createUser({
            identity: {
                authId: "github|1234",
                authName: "github",
                authProviderId: "github",
            },
        });
    });

    afterEach(async () => {
        // Clean-up database
        await resetDB(container.get(TypeORM));
        // Deactivate all services
        await container.unbindAllAsync();
    });

    it("should record audit log", async () => {
        await auditLogService.recordAuditLog(owner.id, "action1", [
            {
                organizationId: org.id,
            },
        ]);

        const logs = await auditLogService.listAuditLogs(owner.id, org.id);

        expect(logs.length).to.eq(1);
    });

    it("should list audit logs", async () => {
        await auditLogDB.recordAuditLog({
            id: v4(),
            timestamp: fromToday(-5),
            organizationId: org.id,
            action: "action1",
            actorId: member.id,
            args: [
                {
                    name: "name1",
                    avatarUrl: "avatarUrl1",
                },
            ],
        });

        await auditLogDB.recordAuditLog({
            id: v4(),
            timestamp: fromToday(-14),
            organizationId: org.id,
            action: "action2",
            actorId: stranger.id,
            args: [
                {
                    name: "name1",
                    avatarUrl: "avatarUrl1",
                },
            ],
        });

        await auditLogDB.recordAuditLog({
            id: v4(),
            timestamp: fromToday(-14),
            organizationId: v4(),
            action: "action2",
            actorId: stranger.id,
            args: [
                {
                    name: "name1",
                    avatarUrl: "avatarUrl1",
                },
            ],
        });

        let logs = await auditLogService.listAuditLogs(owner.id, org.id);

        expect(logs.length).to.eq(2);

        // filter by action
        logs = await auditLogService.listAuditLogs(owner.id, org.id, {
            action: "action1",
        });

        expect(logs.length).to.eq(1);

        // filter by actorId

        logs = await auditLogService.listAuditLogs(owner.id, org.id, {
            actorId: member.id,
        });

        expect(logs.length).to.eq(1);

        // filter by timestamp

        logs = await auditLogService.listAuditLogs(owner.id, org.id, {
            from: fromToday(-15),
            to: fromToday(-10),
        });

        expect(logs.length).to.eq(1);
    });

    it("should purge audit logs", async () => {
        function recordLog(days: number) {
            return auditLogDB.recordAuditLog({
                id: v4(),
                timestamp: fromToday(days),
                organizationId: org.id,
                action: "action2",
                actorId: member.id,
                args: [
                    {
                        name: "name1",
                        avatarUrl: "avatarUrl1",
                    },
                ],
            });
        }

        await recordLog(-1);
        await recordLog(-2);
        await recordLog(-3);
        await recordLog(-4);
        await recordLog(-5);
        await recordLog(-6);
        await recordLog(-7);
        await recordLog(-8);

        let logs = await auditLogService.listAuditLogs(owner.id, org.id);

        expect(logs.length).to.eq(8);

        let affected = await auditLogService.purgeAuditLogs(fromToday(-8));

        expect(affected).to.eq(1);

        affected = await auditLogService.purgeAuditLogs(fromToday(-5));

        expect(affected).to.eq(3);

        logs = await auditLogService.listAuditLogs(owner.id, org.id);
        expect(logs.length, `${logs.map((l) => l.timestamp).join(",")}`).to.eq(4);
    });
});
