/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { DBWithTracing, MaybeWorkspaceInstance, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { WorkspaceClassesConfig } from "./workspace-classes";
import { PrebuiltWorkspace, User, Workspace, WorkspaceInstance, WorkspaceType } from "@gitpod/gitpod-protocol";
import { IDEOption, IDEOptions } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import * as chai from "chai";
import { migrationIDESettings, chooseIDE, getWorkspaceClassForInstance } from "./workspace-starter";
import { MockTracer } from "opentracing";
import { CustomTracerOpts, TraceContext, TracingManager } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { JaegerTracer } from "jaeger-client";
import { EntitlementService } from "../billing/entitlement-service";
import { EntitlementServiceChargebee } from "../../ee/src/billing/entitlement-service-chargebee";
const expect = chai.expect;

describe("workspace-starter", function () {
    describe("migrationIDESettings", function () {
        it("with no ideSettings should be undefined", function () {
            const user: User = {
                id: "string",
                creationDate: "string",
                identities: [],
                additionalData: {},
            };
            const result = migrationIDESettings(user);
            expect(result).to.undefined;
        });

        it("with settingVersion 2.0 should be undefined", function () {
            const user: User = {
                id: "string",
                creationDate: "string",
                identities: [],
                additionalData: {
                    ideSettings: {
                        settingVersion: "2.0",
                        defaultIde: "code-latest",
                        useDesktopIde: false,
                    },
                },
            };
            const result = migrationIDESettings(user);
            expect(result).to.undefined;
        });

        it("with code-latest should be code latest", function () {
            const user: User = {
                id: "string",
                creationDate: "string",
                identities: [],
                additionalData: {
                    ideSettings: {
                        defaultIde: "code-latest",
                        useDesktopIde: false,
                    },
                },
            };
            const result = migrationIDESettings(user);
            expect(result?.defaultIde).to.equal("code");
            expect(result?.useLatestVersion ?? false).to.be.true;
        });

        it("with code-desktop-insiders should be code-desktop latest", function () {
            const user: User = {
                id: "string",
                creationDate: "string",
                identities: [],
                additionalData: {
                    ideSettings: {
                        defaultIde: "code",
                        defaultDesktopIde: "code-desktop-insiders",
                        useDesktopIde: true,
                    },
                },
            };
            const result = migrationIDESettings(user);
            expect(result?.defaultIde).to.equal("code-desktop");
            expect(result?.useLatestVersion ?? false).to.be.true;
        });

        it("with code-desktop should be code-desktop", function () {
            const user: User = {
                id: "string",
                creationDate: "string",
                identities: [],
                additionalData: {
                    ideSettings: {
                        defaultIde: "code",
                        defaultDesktopIde: "code-desktop",
                        useDesktopIde: true,
                    },
                },
            };
            const result = migrationIDESettings(user);
            expect(result?.defaultIde).to.equal("code-desktop");
            expect(result?.useLatestVersion ?? false).to.be.false;
        });

        it("with intellij should be intellij", function () {
            const user: User = {
                id: "string",
                creationDate: "string",
                identities: [],
                additionalData: {
                    ideSettings: {
                        defaultIde: "code",
                        defaultDesktopIde: "intellij",
                        useLatestVersion: false,
                        useDesktopIde: true,
                    },
                },
            };
            const result = migrationIDESettings(user);
            expect(result?.defaultIde).to.equal("intellij");
            expect(result?.useLatestVersion ?? false).to.be.false;
        });

        it("with intellij latest version  should be intellij latest", function () {
            const user: User = {
                id: "string",
                creationDate: "string",
                identities: [],
                additionalData: {
                    ideSettings: {
                        defaultIde: "code",
                        defaultDesktopIde: "intellij",
                        useLatestVersion: true,
                        useDesktopIde: true,
                    },
                },
            };
            const result = migrationIDESettings(user);
            expect(result?.defaultIde).to.equal("intellij");
            expect(result?.useLatestVersion ?? false).to.be.true;
        });

        it("with user desktopIde false should be code latest", function () {
            const user: User = {
                id: "string",
                creationDate: "string",
                identities: [],
                additionalData: {
                    ideSettings: {
                        defaultIde: "code-latest",
                        defaultDesktopIde: "intellij",
                        useLatestVersion: false,
                        useDesktopIde: false,
                    },
                },
            };
            const result = migrationIDESettings(user);
            expect(result?.defaultIde).to.equal("code");
            expect(result?.useLatestVersion ?? false).to.be.true;
        });
    });
    describe("chooseIDE", async function () {
        const baseOpt: IDEOption = {
            title: "title",
            type: "desktop",
            logo: "",
            image: "image",
            latestImage: "latestImage",
        };
        const ideOptions: IDEOptions = {
            options: {
                code: Object.assign({}, baseOpt, { type: "browser" }),
                goland: Object.assign({}, baseOpt),
                "code-desktop": Object.assign({}, baseOpt),
                "no-latest": Object.assign({}, baseOpt),
            },
            defaultIde: "code",
            defaultDesktopIde: "code-desktop",
        };
        delete ideOptions.options["no-latest"].latestImage;

        it("code with latest", function () {
            const useLatest = true;
            const hasPerm = false;
            const result = chooseIDE("code", ideOptions, useLatest, hasPerm);
            expect(result.ideImage).to.equal(ideOptions.options["code"].latestImage);
        });

        it("code without latest", function () {
            const useLatest = false;
            const hasPerm = false;
            const result = chooseIDE("code", ideOptions, useLatest, hasPerm);
            expect(result.ideImage).to.equal(ideOptions.options["code"].image);
        });

        it("desktop ide with latest", function () {
            const useLatest = true;
            const hasPerm = false;
            const result = chooseIDE("code-desktop", ideOptions, useLatest, hasPerm);
            expect(result.ideImage).to.equal(ideOptions.options["code"].latestImage);
            expect(result.desktopIdeImage).to.equal(ideOptions.options["code-desktop"].latestImage);
        });

        it("desktop ide (JetBrains) without latest", function () {
            const useLatest = false;
            const hasPerm = false;
            const result = chooseIDE("goland", ideOptions, useLatest, hasPerm);
            expect(result.ideImage).to.equal(ideOptions.options["code"].image);
            expect(result.desktopIdeImage).to.equal(ideOptions.options["goland"].image);
        });

        it("desktop ide with no latest image", function () {
            const useLatest = true;
            const hasPerm = false;
            const result = chooseIDE("no-latest", ideOptions, useLatest, hasPerm);
            expect(result.ideImage).to.equal(ideOptions.options["code"].latestImage);
            expect(result.desktopIdeImage).to.equal(ideOptions.options["no-latest"].image);
        });

        it("unknown ide with custom permission should be unknown", function () {
            const customOptions = Object.assign({}, ideOptions);
            customOptions.options["unknown-custom"] = {
                title: "unknown title",
                type: "browser",
                logo: "",
                image: "",
            };
            const useLatest = true;
            const hasPerm = true;
            const result = chooseIDE("unknown-custom", customOptions, useLatest, hasPerm);
            expect(result.ideImage).to.equal("unknown-custom");
        });

        it("unknown desktop ide with custom permission desktop should be unknown", function () {
            const customOptions = Object.assign({}, ideOptions);
            customOptions.options["unknown-custom"] = {
                title: "unknown title",
                type: "desktop",
                logo: "",
                image: "",
            };
            const useLatest = true;
            const hasPerm = true;
            const result = chooseIDE("unknown-custom", customOptions, useLatest, hasPerm);
            expect(result.desktopIdeImage).to.equal("unknown-custom");
        });

        it("unknown browser ide without custom permission should fallback to code", function () {
            const customOptions = Object.assign({}, ideOptions);
            customOptions.options["unknown-custom"] = {
                title: "unknown title",
                type: "browser",
                logo: "",
                image: "",
            };
            const useLatest = true;
            const hasPerm = false;
            const result = chooseIDE("unknown-custom", customOptions, useLatest, hasPerm);
            expect(result.ideImage).to.equal(ideOptions.options["code"].latestImage);
        });

        it("not exists ide with custom permission", function () {
            const useLatest = true;
            const hasPerm = true;
            const result = chooseIDE("not-exists", ideOptions, useLatest, hasPerm);
            expect(result.ideImage).to.equal(ideOptions.options["code"].latestImage);
        });

        it("not exists ide with custom permission", function () {
            const useLatest = true;
            const hasPerm = false;
            const result = chooseIDE("not-exists", ideOptions, useLatest, hasPerm);
            expect(result.ideImage).to.equal(ideOptions.options["code"].latestImage);
        });
    });
    describe("selectWorkspaceClass", function () {
        it("new regular workspace, without prebuild, regular class configured", async function () {
            const builder = new WorkspaceClassTestBuilder("regular").withRegularClassConfigured("g1-standard");
            await execute(builder, "g1-standard");
        });
        it("new regular workspace, without prebuild, class not configured, has more resources", async function () {
            const builder = new WorkspaceClassTestBuilder("regular").withHasMoreResources();
            await execute(builder, "g1-large");
        });

        it("new regular workspace, without prebuild, class not configured, does not have more resources", async function () {
            const builder = new WorkspaceClassTestBuilder("regular");
            await execute(builder, "g1-standard");
        });

        it("restarted workspace", async function () {
            const builder = new WorkspaceClassTestBuilder("regular").withPreviousInstance("g1-large");
            await execute(builder, "g1-large");
        });

        it("restarted workspace, class does not exist, fallback to default class", async function () {
            const builder = new WorkspaceClassTestBuilder("regular").withPreviousInstance("g1-unknown");
            await execute(builder, "g1-standard");
        });

        it("restarted workspace, class is deprecated, fallback to default class", async function () {
            const builder = new WorkspaceClassTestBuilder("regular").withPreviousInstance("g1-deprecated");
            await execute(builder, "g1-standard");
        });

        it("new prebuild workspace, prebuild class configured", async function () {
            const builder = new WorkspaceClassTestBuilder("prebuild").withPrebuildClassConfigured("g1-large");
            await execute(builder, "g1-large");
        });

        it("new prebuild workspace, prebuild class not configured, has more resources", async function () {
            const builder = new WorkspaceClassTestBuilder("prebuild").withHasMoreResources();
            await execute(builder, "g1-large");
        });

        it("new prebuild workspace, prebuild class not configured, does not have more resources", async function () {
            const builder = new WorkspaceClassTestBuilder("prebuild");
            await execute(builder, "g1-standard");
        });
    });
});

async function execute(builder: WorkspaceClassTestBuilder, expectedClass: string) {
    let [ctx, workspace, previousInstance, user, entitlementService, config, workspaceDb] = builder.build();

    let actualClass = await getWorkspaceClassForInstance(
        ctx,
        workspace,
        previousInstance,
        user,
        entitlementService,
        config,
        workspaceDb,
    );
    expect(actualClass).to.equal(expectedClass);
}

class WorkspaceClassTestBuilder {
    // Type of the workspace that is being created e.g. regular or prebuild
    workspaceType: WorkspaceType;

    // The workspace class of the previous instance of the workspace
    previousInstanceClass: string;

    // The class configured by the user for a regular workspace
    configuredRegularClass: string;

    // The class configured by the user for a prebuild workspace
    configuredPrebuildClass: string;

    // Workspace is based on a prebuild
    basedOnPrebuild: string;

    // User has more resources
    hasMoreResources: boolean;

    constructor(workspaceType: WorkspaceType) {
        this.workspaceType = workspaceType;
    }

    public withPreviousInstance(classId: string): WorkspaceClassTestBuilder {
        this.previousInstanceClass = classId;
        return this;
    }

    public withPrebuild(): WorkspaceClassTestBuilder {
        this.basedOnPrebuild = "0kaks09j";
        return this;
    }

    public withRegularClassConfigured(classId: string): WorkspaceClassTestBuilder {
        this.configuredRegularClass = classId;
        return this;
    }

    public withPrebuildClassConfigured(classId: string): WorkspaceClassTestBuilder {
        this.configuredPrebuildClass = classId;
        return this;
    }

    public withHasMoreResources(): WorkspaceClassTestBuilder {
        this.hasMoreResources = true;
        return this;
    }

    public build(): [
        TraceContext,
        Workspace,
        WorkspaceInstance,
        User,
        EntitlementService,
        WorkspaceClassesConfig,
        DBWithTracing<WorkspaceDB>,
    ] {
        const tracer = new MockTracer();
        const span = tracer.startSpan("testspan");
        const ctx = {
            span,
        };

        const workspace: Workspace = {
            basedOnPrebuildId: this.basedOnPrebuild,
            type: this.workspaceType,
        } as Workspace;

        const previousInstance: WorkspaceInstance = {
            workspaceClass: this.previousInstanceClass,
        } as WorkspaceInstance;

        let user: User = {
            id: "string",
            creationDate: "string",
            identities: [],
            additionalData: {
                workspaceClasses: {
                    regular: this.configuredRegularClass,
                    prebuild: this.configuredPrebuildClass,
                },
            },
        };

        const entitlementService: EntitlementService = new MockEntitlementService(this.hasMoreResources);

        let config: WorkspaceClassesConfig = [
            {
                id: "g1-standard",
                isDefault: true,
                category: "GENERAL PURPOSE",
                displayName: "Standard",
                description: "Up to 4 vCPU, 8 GB memory, 30GB storage",
                powerups: 1,
                deprecated: false,
                resources: {
                    cpu: 4,
                    memory: 8,
                    storage: 30,
                },
            },
        ];

        config.push({
            id: "g1-large",
            isDefault: false,
            category: "GENERAL PURPOSE",
            displayName: "Large",
            description: "Up to 8 vCPU, 16 GB memory, 50GB storage",
            powerups: 2,
            deprecated: false,
            marker: {
                moreResources: this.hasMoreResources,
            },
            resources: {
                cpu: 8,
                memory: 16,
                storage: 50,
            },
        });

        config.push({
            id: "g1-deprecated",
            isDefault: false,
            category: "GENERAL PURPOSE",
            displayName: "Large",
            description: "Up to 8 vCPU, 16 GB memory, 50GB storage",
            powerups: 2,
            deprecated: true,
            resources: {
                cpu: 8,
                memory: 16,
                storage: 50,
            },
        });

        const workspaceDb = new MockWorkspaceDb(!!this.basedOnPrebuild);
        const workspaceDbWithTracing: DBWithTracing<WorkspaceDB> = new DBWithTracing(
            workspaceDb,
            new MockTracingManager(),
        );

        return [ctx, workspace, previousInstance, user, entitlementService, config, workspaceDbWithTracing];
    }
}

class MockEntitlementService extends EntitlementServiceChargebee {
    constructor(protected hasMoreResources: boolean) {
        super();
    }

    userGetsMoreResources(user: User): Promise<boolean> {
        return new Promise((resolve) => {
            resolve(this.hasMoreResources);
        });
    }
}

class MockWorkspaceDb {
    constructor(protected hasPrebuild: boolean) {}

    findPrebuildByID(pwsid: string): Promise<PrebuiltWorkspace | undefined> {
        return new Promise((resolve) => {
            if (this.hasPrebuild) {
                resolve({
                    buildWorkspaceId: "string",
                } as PrebuiltWorkspace);
            } else {
                resolve(undefined);
            }
        });
    }

    findCurrentInstance(workspaceId: string): Promise<MaybeWorkspaceInstance> {
        return new Promise((resolve) => {
            if (this.hasPrebuild) {
                resolve({
                    id: "string",
                } as MaybeWorkspaceInstance);
            } else {
                resolve(undefined);
            }
        });
    }
}

class MockTracingManager extends TracingManager {
    getTracerForService(serviceName: string, opts?: CustomTracerOpts | undefined): JaegerTracer {
        return {} as JaegerTracer;
    }
}
