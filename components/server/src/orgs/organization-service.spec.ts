/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamDB, testContainer } from "@gitpod/gitpod-db/lib";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { OrganizationService } from "./organization-service";
import { InstallationService } from "../auth/installation-service";
import { ProjectsService } from "../projects/projects-service";
import { Authorizer } from "../authorization/authorizer";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { DefaultWorkspaceImageValidator } from "./default-workspace-image-validator";
import { UserService } from "../user/user-service";
import { Config } from "../config";
import { IDEService } from "../ide-service";
import { StripeService } from "../billing/stripe-service";
import { UsageService } from "./usage-service";
import { UserAuthentication } from "../user/user-authentication";

const expect = chai.expect;

describe("OrganizationService", async () => {
    let container: Container;
    let os: OrganizationService;

    describe("listWorkspaceClasses", async () => {
        let allowedWorkspaceClasses: string[] = [];
        let allWorkspaceClasses: { id: string; isDefault?: boolean }[] = [
            { id: "ss" },
            { id: "s" },
            { id: "m", isDefault: true },
            { id: "l" },
            { id: "xl" },
            { id: "2xl" },
        ];
        beforeEach(async () => {
            container = testContainer.createChild();
            container.bind(Config).toConstantValue({} as any as Config);
            container.bind(UserService).toConstantValue({} as any as UserService);
            container.bind(IDEService).toConstantValue({
                getIDEConfig: async () => ({
                    supervisorImage: "foo",
                    ideOptions: {
                        options: {
                            code: {
                                orderKey: "00",
                                title: "VS Code",
                                type: "browser",
                                logo: "https://ide.gitpod.io/image/ide-logo/vscode.svg",
                                label: "Browser",
                                image: "bar",
                                latestImage: "baz",
                            },
                        },
                    },
                }),
            } as any as IDEService);
            container.bind(OrganizationService).toSelf().inSingletonScope();
            container.bind(ProjectsService).toConstantValue({} as any as ProjectsService);
            container.bind(Authorizer).toConstantValue({
                checkPermissionOnOrganization: () => {},
            } as any as Authorizer);
            container.bind(IAnalyticsWriter).toConstantValue({} as any as IAnalyticsWriter);
            container.bind(TeamDB).toConstantValue({
                findOrgSettings: async () => ({
                    allowedWorkspaceClasses,
                }),
            } as any as TeamDB);
            container.bind(DefaultWorkspaceImageValidator).toConstantValue({} as any as DefaultWorkspaceImageValidator);
            container.bind(InstallationService).toConstantValue({
                getInstallationWorkspaceClasses: async () => {
                    return allWorkspaceClasses;
                },
            } as any as InstallationService);
            container.bind(StripeService).toConstantValue({} as any as StripeService);
            container.bind(UsageService).toConstantValue({} as any as UsageService);
            container.bind(UserAuthentication).toConstantValue({} as any as UserAuthentication);
            os = container.get(OrganizationService);
        });

        const setupAllowed = (allowed: ("ss" | "s" | "m" | "l" | "xl" | "2xl" | "unknown")[]) => {
            allowedWorkspaceClasses = allowed;
        };

        const setupAll = (all?: { id: string; isDefault?: boolean }[]) => {
            if (!all) {
                allWorkspaceClasses = [
                    { id: "ss" },
                    { id: "s" },
                    { id: "m", isDefault: true },
                    { id: "l" },
                    { id: "xl" },
                    { id: "2xl" },
                ];
                return;
            }
            allWorkspaceClasses = all;
        };

        it("should use default s if there only has it allowed", async () => {
            setupAll();
            setupAllowed(["s"]);
            const list = await os.listWorkspaceClasses("", "");
            expect(list.length).to.equal(1);
            expect(list.map((e) => e.id)).to.eql(["s"]);
            expect(list[0].isDefault).to.equal(true);
        });

        it("should use default s as it's closest one", async () => {
            setupAll();
            setupAllowed(["ss", "s"]);
            const list = await os.listWorkspaceClasses("", "");
            expect(list.length).to.equal(2);
            expect(list.map((e) => e.id)).to.eql(["ss", "s"]);
            expect(list[1].isDefault).to.equal(true);
        });

        it("should use default m if m is included", async () => {
            setupAll();
            setupAllowed(["s", "m", "xl"]);
            const list = await os.listWorkspaceClasses("", "");
            expect(list.length).to.equal(3);
            expect(list.map((e) => e.id)).to.eql(["s", "m", "xl"]);
            expect(list[1].isDefault).to.equal(true);
        });

        it("should use default s as it's closest and smaller one", async () => {
            setupAll();
            setupAllowed(["s", "xl"]);
            const list = await os.listWorkspaceClasses("", "");
            expect(list.length).to.equal(2);
            expect(list.map((e) => e.id)).to.eql(["s", "xl"]);
            expect(list[0].isDefault).to.equal(true);
        });

        it("should use default xl as it's closest and smaller one", async () => {
            setupAll();
            setupAllowed(["xl", "2xl"]);
            const list = await os.listWorkspaceClasses("", "");
            expect(list.length).to.equal(2);
            expect(list.map((e) => e.id)).to.eql(["xl", "2xl"]);
            expect(list[0].isDefault).to.equal(true);
        });

        it("should use closet one even default is at the end of array", async () => {
            setupAll([{ id: "ss" }, { id: "s" }, { id: "m", isDefault: true }]);
            setupAllowed(["s", "ss"]);
            const list = await os.listWorkspaceClasses("", "");
            expect(list.length).to.equal(2);
            expect(list.map((e) => e.id)).to.eql(["ss", "s"]);
            expect(list[1].isDefault).to.equal(true);
        });

        it("should use closet one even default is at the start of array", async () => {
            setupAll([{ id: "m", isDefault: true }, { id: "xl" }, { id: "2xl" }]);
            setupAllowed(["xl", "2xl"]);
            const list = await os.listWorkspaceClasses("", "");
            expect(list.length).to.equal(2);
            expect(list.map((e) => e.id)).to.eql(["xl", "2xl"]);
            expect(list[0].isDefault).to.equal(true);
        });

        it("happy path", async () => {
            setupAll([{ id: "s" }, { id: "m", isDefault: true }, { id: "xl" }]);
            setupAllowed(["xl"]);
            const list = await os.listWorkspaceClasses("", "");
            expect(list.length).to.equal(1);
            expect(list.map((e) => e.id)).to.eql(["xl"]);
            expect(list[0].isDefault).to.equal(true);
        });

        it("happy path with unknown", async () => {
            setupAll([{ id: "s" }, { id: "m", isDefault: true }, { id: "xl" }]);
            setupAllowed(["unknown"]);
            const list = await os.listWorkspaceClasses("", "");
            expect(list.length).to.equal(0);
            const settings = await os.getSettings("", "");
            expect(settings.allowedWorkspaceClasses?.length).to.equal(1);
            expect(settings.allowedWorkspaceClasses).to.eql(["unknown"]);
        });
    });
});
