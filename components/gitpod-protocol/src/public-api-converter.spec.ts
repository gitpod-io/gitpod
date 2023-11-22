/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Timestamp } from "@bufbuild/protobuf";
import {
    AdmissionLevel,
    WorkspaceEnvironmentVariable,
    WorkspacePhase_Phase,
    WorkspacePort_Policy,
    WorkspacePort_Protocol,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { expect } from "chai";
import { PartialConfiguration, PublicAPIConverter } from "./public-api-converter";
import { OrgMemberInfo, Project, PrebuildSettings as PrebuildSettingsProtocol } from "./teams-projects-protocol";
import { OrganizationRole } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import {
    BranchMatchingStrategy,
    PrebuildSettings,
    WorkspaceSettings,
} from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import {
    AuthProviderEntry,
    AuthProviderInfo,
    ProjectEnvVar,
    SuggestedRepository,
    Token,
    UserEnvVarValue,
    WithEnvvarsContext,
} from "./protocol";
import {
    AuthProvider,
    AuthProviderDescription,
    AuthProviderType,
} from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import {
    ConfigurationEnvironmentVariable,
    EnvironmentVariableAdmission,
    UserEnvironmentVariable,
} from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";

describe("PublicAPIConverter", () => {
    const converter = new PublicAPIConverter();

    describe("toOrganization", () => {
        it("should convert a ProtocolOrganization to an Organization", () => {
            const org = {
                id: "123",
                name: "My Org",
                slug: "my-org",
                creationTime: "2022-01-01T00:00:00.000Z",
            };
            const result = converter.toOrganization(org);
            expect(result.id).to.equal(org.id);
            expect(result.name).to.equal(org.name);
            expect(result.slug).to.equal(org.slug);
            expect(result.creationTime).to.deep.equal(Timestamp.fromDate(new Date(org.creationTime)));
        });
    });

    describe("toOrganizationMember", () => {
        it("should convert an OrgMemberInfo to an OrganizationMember", () => {
            const member: OrgMemberInfo = {
                userId: "456",
                fullName: "John Doe",
                primaryEmail: "john.doe@example.com",
                avatarUrl: "https://example.com/avatar.jpg",
                role: "owner",
                memberSince: "2022-01-01T00:00:00.000Z",
                ownedByOrganization: true,
            };
            const result = converter.toOrganizationMember(member);
            expect(result.userId).to.equal(member.userId);
            expect(result.fullName).to.equal(member.fullName);
            expect(result.email).to.equal(member.primaryEmail);
            expect(result.avatarUrl).to.equal(member.avatarUrl);
            expect(result.role).to.equal(converter.toOrgMemberRole(member.role));
            expect(result.memberSince).to.deep.equal(Timestamp.fromDate(new Date(member.memberSince)));
            expect(result.ownedByOrganization).to.equal(member.ownedByOrganization);
        });
    });

    describe("toOrgMemberRole", () => {
        it("should convert an OrgMemberRole to an OrganizationRole", () => {
            expect(converter.toOrgMemberRole("owner")).to.equal(OrganizationRole.OWNER);
            expect(converter.toOrgMemberRole("member")).to.equal(OrganizationRole.MEMBER);
            expect(converter.toOrgMemberRole("unknown" as any)).to.equal(OrganizationRole.UNSPECIFIED);
        });
    });

    describe("fromOrgMemberRole", () => {
        it("should convert an OrganizationRole to an OrgMemberRole", () => {
            expect(converter.fromOrgMemberRole(OrganizationRole.OWNER)).to.equal("owner");
            expect(converter.fromOrgMemberRole(OrganizationRole.MEMBER)).to.equal("member");
            expect(() => converter.fromOrgMemberRole(OrganizationRole.UNSPECIFIED)).to.throw(Error);
        });
    });

    describe("fromPartialConfiguration", () => {
        it("should convert a configuration name change to a Project", () => {
            const config: PartialConfiguration = {
                id: "123",
                name: "My Config",
            };
            const result = converter.fromPartialConfiguration(config);
            expect(result.id).to.equal(config.id);
            expect(result.settings).to.be.undefined;
        });
        it("should carry over Configuration settings correctly", () => {
            const config: PartialConfiguration = {
                id: "123",
                name: undefined,
                workspaceSettings: {
                    workspaceClass: "huge",
                },
                prebuildSettings: {
                    enabled: true,
                    prebuildInterval: 5,
                },
            };
            const result = converter.fromPartialConfiguration(config);
            expect(result.id).to.equal(config.id);
            expect(result.settings?.workspaceClasses?.regular).to.deep.equal("huge");
            expect(result.settings?.prebuilds?.enable).to.deep.equal(true);
            expect(result.settings?.prebuilds?.prebuildInterval).to.deep.equal(5);
            expect(result).to.not.have.property("name");
            expect(result).to.not.have.deep.property("result.settings.prebuilds.workspaceClass");
            expect(result).to.not.have.deep.property("result.settings.prebuilds.branchStrategy");
        });
    });

    describe("testToWorkspace", () => {
        it("should convert workspaces", () => {
            let workspace = converter.toWorkspace({
                workspace: {
                    id: "akosyakov-parceldemo-4crqn25qlwi",
                    creationTime: "2023-10-16T20:18:24.859Z",
                    organizationId: "ec76db37-9a48-4e2d-a78e-0ec7d2b4d2c0",
                    ownerId: "827df1c8-d42d-4a69-bc38-64089af1f711",
                    contextURL: "https://github.com/akosyakov/parcel-demo",
                    description: "akosyakov/parcel-demo - master",
                    context: {
                        isFile: false,
                        path: "",
                        title: "akosyakov/parcel-demo - master",
                        ref: "master",
                        refType: "branch",
                        revision: "60dbf818194082ef1a368bacd49cfd25a34c9256",
                        repository: {
                            cloneUrl: "https://github.com/akosyakov/parcel-demo.git",
                            host: "github.com",
                            defaultBranch: "master",
                            name: "parcel-demo",
                            owner: "akosyakov",
                            private: false,
                        },
                        normalizedContextURL: "https://github.com/akosyakov/parcel-demo",
                        checkoutLocation: "parcel-demo",
                    },
                    cloneUrl: "https://github.com/akosyakov/parcel-demo.git",
                    config: {
                        tasks: [
                            {
                                init: "yarn",
                                command: "yarn serve",
                            },
                            {
                                command: "gp open index.js\ngp preview $(gp url 1234)\n",
                                openMode: "split-right",
                            },
                        ],
                        _origin: "repo",
                        image: "docker.io/gitpod/workspace-full:latest",
                        vscode: {
                            extensions: [],
                        },
                    },
                    imageSource: {
                        baseImageResolved: "docker.io/gitpod/workspace-full:latest",
                    },
                    imageNameResolved:
                        "eu.gcr.io/gitpod-core-dev/build/workspace-images:d6d9404137cc976d4da4d450474cb515bc0512281a3649c1cab9309ba7caee65",
                    baseImageNameResolved:
                        "docker.io/gitpod/workspace-full@sha256:10d6ab95512fe70bf6274976b19f94327570559e3d29f4b1cb01735b6fe534bb",
                    shareable: false,
                    type: "regular",
                    softDeleted: null,
                    deleted: false,
                    pinned: false,
                },
                latestInstance: {
                    id: "226695b4-f10a-471a-a219-9b657645bf78",
                    workspaceId: "akosyakov-parceldemo-4crqn25qlwi",
                    region: "dev",
                    creationTime: "2023-10-16T20:18:24.923Z",
                    ideUrl: "https://akosyakov-parceldemo-4crqn25qlwi.ws-dev.ak-public-26583c8c5c.preview.gitpod-dev.com",
                    status: {
                        phase: "creating",
                        message: "",
                        timeout: "30m0s",
                        version: 220880,
                        conditions: {
                            failed: "",
                            timeout: "",
                            deployed: true,
                            pullingImages: false,
                            stoppedByRequest: false,
                            headlessTaskFailed: "",
                        },
                        exposedPorts: [],
                    },
                    gitStatus: null,
                    phasePersisted: "creating",
                    deleted: false,
                    configuration: {
                        ideImage:
                            "eu.gcr.io/gitpod-core-dev/build/ide/code:commit-e77f3a07ea76bbb404d3f6bf4af36269afc45df1",
                        ideImageLayers: [
                            "eu.gcr.io/gitpod-core-dev/build/ide/gitpod-code-web:commit-49bb715b599dce2356dd02a6ede7ae8cf10d8d12",
                            "eu.gcr.io/gitpod-core-dev/build/ide/code-codehelper:commit-18a48e2ccb779a268355d2b58a167c73de023547",
                        ],
                        supervisorImage:
                            "eu.gcr.io/gitpod-core-dev/build/supervisor:commit-cda78d5706672b9a41e15d84a128cdb24357ad87",
                        ideConfig: {
                            useLatest: false,
                            ide: "code",
                        },
                        ideSetup: {
                            envvars: [
                                {
                                    name: "GITPOD_CONFIGCAT_ENABLED",
                                    value: "true",
                                },
                                {
                                    name: "GITPOD_IDE_ALIAS",
                                    value: "code",
                                },
                            ],
                            tasks: [],
                        },
                        regionPreference: "",
                        fromBackup: false,
                        featureFlags: ["workspace_connection_limiting", "workspace_class_limiting"],
                    },
                    imageBuildInfo: null,
                    workspaceClass: "g1-standard",
                    usageAttributionId: "team:ec76db37-9a48-4e2d-a78e-0ec7d2b4d2c0",
                },
            } as any);
            expect(workspace).to.deep.equal(
                {
                    id: "akosyakov-parceldemo-4crqn25qlwi",
                    prebuild: false,
                    organizationId: "ec76db37-9a48-4e2d-a78e-0ec7d2b4d2c0",
                    name: "akosyakov/parcel-demo - master",
                    pinned: false,
                    status: {
                        phase: {
                            name: WorkspacePhase_Phase.CREATING,
                            lastTransitionTime: Timestamp.fromDate(new Date("2023-10-16T20:18:24.923Z")),
                        },
                        message: "",
                        workspaceUrl:
                            "https://akosyakov-parceldemo-4crqn25qlwi.ws-dev.ak-public-26583c8c5c.preview.gitpod-dev.com",
                        gitStatus: {
                            branch: "master",
                            cloneUrl: "https://github.com/akosyakov/parcel-demo.git",
                            latestCommit: "60dbf818194082ef1a368bacd49cfd25a34c9256",
                            totalUncommitedFiles: 0,
                            totalUnpushedCommits: 0,
                            totalUntrackedFiles: 0,
                            uncommitedFiles: [],
                            unpushedCommits: [],
                            untrackedFiles: [],
                        },
                        ports: [],
                        admission: AdmissionLevel.OWNER_ONLY,
                        instanceId: "226695b4-f10a-471a-a219-9b657645bf78",
                        conditions: {
                            failed: "",
                            timeout: "",
                        },
                    },
                    additionalEnvironmentVariables: [],
                    region: "dev",
                    prebuildId: "",
                    workspaceClass: "g1-standard",
                    editor: {
                        name: "code",
                        version: "stable",
                    },
                    contextUrl: "https://github.com/akosyakov/parcel-demo",
                },
                "created",
            );
            workspace = converter.toWorkspace(
                {
                    id: "226695b4-f10a-471a-a219-9b657645bf78",
                    workspaceId: "akosyakov-parceldemo-4crqn25qlwi",
                    region: "dev",
                    creationTime: "2023-10-16T20:18:24.923Z",
                    startedTime: "2023-10-16T20:18:53.451Z",
                    ideUrl: "https://akosyakov-parceldemo-4crqn25qlwi.ws-dev.ak-public-26583c8c5c.preview.gitpod-dev.com",
                    status: {
                        phase: "running",
                        message: "",
                        timeout: "30m0s",
                        version: 221053,
                        conditions: {
                            failed: "",
                            timeout: "",
                            deployed: true,
                            pullingImages: false,
                            stoppedByRequest: false,
                            firstUserActivity: "2023-10-16T20:18:53.000Z",
                            headlessTaskFailed: "",
                        },
                        exposedPorts: [
                            {
                                url: "https://1234-akosyakov-parceldemo-4crqn25qlwi.ws-dev.ak-public-26583c8c5c.preview.gitpod-dev.com",
                                port: 1234,
                                protocol: "http",
                                visibility: "public",
                            },
                        ],
                    },
                    gitStatus: {
                        branch: "ak/test",
                        latestCommit: "2203d16573ee3838e6a2a19d5cf678fb706f4885",
                        uncommitedFiles: ["index.js"],
                        unpushedCommits: ["2203d16: tests"],
                        totalUncommitedFiles: 1,
                        totalUnpushedCommits: 1,
                    },
                    phasePersisted: "running",
                    deleted: false,
                    configuration: {
                        ideImage:
                            "eu.gcr.io/gitpod-core-dev/build/ide/code:commit-e77f3a07ea76bbb404d3f6bf4af36269afc45df1",
                        ideImageLayers: [
                            "eu.gcr.io/gitpod-core-dev/build/ide/gitpod-code-web:commit-49bb715b599dce2356dd02a6ede7ae8cf10d8d12",
                            "eu.gcr.io/gitpod-core-dev/build/ide/code-codehelper:commit-18a48e2ccb779a268355d2b58a167c73de023547",
                        ],
                        supervisorImage:
                            "eu.gcr.io/gitpod-core-dev/build/supervisor:commit-cda78d5706672b9a41e15d84a128cdb24357ad87",
                        ideConfig: {
                            useLatest: false,
                            ide: "code",
                        },
                        ideSetup: {
                            envvars: [
                                {
                                    name: "GITPOD_CONFIGCAT_ENABLED",
                                    value: "true",
                                },
                                {
                                    name: "GITPOD_IDE_ALIAS",
                                    value: "code",
                                },
                            ],
                            tasks: [],
                        },
                        regionPreference: "",
                        fromBackup: false,
                        featureFlags: ["workspace_connection_limiting", "workspace_class_limiting"],
                    },
                    imageBuildInfo: null,
                    workspaceClass: "g1-standard",
                    usageAttributionId: "team:ec76db37-9a48-4e2d-a78e-0ec7d2b4d2c0",
                } as any,
                workspace,
            );
            expect(workspace).to.deep.equal(
                {
                    id: "akosyakov-parceldemo-4crqn25qlwi",
                    prebuild: false,
                    organizationId: "ec76db37-9a48-4e2d-a78e-0ec7d2b4d2c0",
                    name: "akosyakov/parcel-demo - master",
                    pinned: false,
                    status: {
                        phase: {
                            name: WorkspacePhase_Phase.RUNNING,
                            lastTransitionTime: Timestamp.fromDate(new Date("2023-10-16T20:18:53.451Z")),
                        },
                        message: "",
                        workspaceUrl:
                            "https://akosyakov-parceldemo-4crqn25qlwi.ws-dev.ak-public-26583c8c5c.preview.gitpod-dev.com",
                        gitStatus: {
                            branch: "ak/test",
                            cloneUrl: "https://github.com/akosyakov/parcel-demo.git",
                            latestCommit: "2203d16573ee3838e6a2a19d5cf678fb706f4885",
                            totalUncommitedFiles: 1,
                            totalUnpushedCommits: 1,
                            totalUntrackedFiles: 0,
                            uncommitedFiles: ["index.js"],
                            unpushedCommits: ["2203d16: tests"],
                            untrackedFiles: [],
                        },
                        ports: [
                            {
                                policy: WorkspacePort_Policy.PUBLIC,
                                port: BigInt(1234),
                                protocol: WorkspacePort_Protocol.HTTP,
                                url: "https://1234-akosyakov-parceldemo-4crqn25qlwi.ws-dev.ak-public-26583c8c5c.preview.gitpod-dev.com",
                            },
                        ],
                        admission: AdmissionLevel.OWNER_ONLY,
                        instanceId: "226695b4-f10a-471a-a219-9b657645bf78",
                        conditions: {
                            failed: "",
                            timeout: "",
                        },
                    },
                    additionalEnvironmentVariables: [],
                    region: "dev",
                    prebuildId: "",
                    workspaceClass: "g1-standard",
                    editor: {
                        name: "code",
                        version: "stable",
                    },
                    contextUrl: "https://github.com/akosyakov/parcel-demo",
                },
                "running",
            );
            workspace = converter.toWorkspace(
                {
                    id: "226695b4-f10a-471a-a219-9b657645bf78",
                    workspaceId: "akosyakov-parceldemo-4crqn25qlwi",
                    region: "dev",
                    creationTime: "2023-10-16T20:18:24.923Z",
                    startedTime: "2023-10-16T20:18:53.451Z",
                    stoppingTime: "2023-10-16T20:36:14.802Z",
                    stoppedTime: "2023-10-16T20:36:16.205Z",
                    ideUrl: "https://akosyakov-parceldemo-4crqn25qlwi.ws-dev.ak-public-26583c8c5c.preview.gitpod-dev.com",
                    status: {
                        repo: {
                            branch: "ak/test",
                            latestCommit: "2203d16573ee3838e6a2a19d5cf678fb706f4885",
                            uncommitedFiles: ["index.js"],
                            unpushedCommits: ["2203d16: tests"],
                            totalUntrackedFiles: 0,
                            totalUncommitedFiles: 1,
                            totalUnpushedCommits: 1,
                        },
                        phase: "stopped",
                        message: "",
                        timeout: "30m0s",
                        version: 226943,
                        conditions: {
                            failed: "",
                            timeout: "",
                            deployed: true,
                            pullingImages: false,
                            stoppedByRequest: true,
                            firstUserActivity: "2023-10-16T20:18:53.000Z",
                            headlessTaskFailed: "",
                        },
                        exposedPorts: [
                            {
                                url: "https://1234-akosyakov-parceldemo-4crqn25qlwi.ws-dev.ak-public-26583c8c5c.preview.gitpod-dev.com",
                                port: 1234,
                                protocol: "http",
                                visibility: "public",
                            },
                        ],
                    },
                    gitStatus: {
                        branch: "ak/test",
                        latestCommit: "2203d16573ee3838e6a2a19d5cf678fb706f4885",
                        uncommitedFiles: ["index.js"],
                        unpushedCommits: ["2203d16: tests"],
                        totalUncommitedFiles: 1,
                        totalUnpushedCommits: 1,
                    },
                    phasePersisted: "stopped",
                    deleted: false,
                    configuration: {
                        ideImage:
                            "eu.gcr.io/gitpod-core-dev/build/ide/code:commit-e77f3a07ea76bbb404d3f6bf4af36269afc45df1",
                        ideImageLayers: [
                            "eu.gcr.io/gitpod-core-dev/build/ide/gitpod-code-web:commit-49bb715b599dce2356dd02a6ede7ae8cf10d8d12",
                            "eu.gcr.io/gitpod-core-dev/build/ide/code-codehelper:commit-18a48e2ccb779a268355d2b58a167c73de023547",
                        ],
                        supervisorImage:
                            "eu.gcr.io/gitpod-core-dev/build/supervisor:commit-cda78d5706672b9a41e15d84a128cdb24357ad87",
                        ideConfig: {
                            useLatest: false,
                            ide: "code",
                        },
                        ideSetup: {
                            envvars: [
                                {
                                    name: "GITPOD_CONFIGCAT_ENABLED",
                                    value: "true",
                                },
                                {
                                    name: "GITPOD_IDE_ALIAS",
                                    value: "code",
                                },
                            ],
                            tasks: [],
                        },
                        regionPreference: "",
                        fromBackup: false,
                        featureFlags: ["workspace_connection_limiting", "workspace_class_limiting"],
                    },
                    imageBuildInfo: null,
                    workspaceClass: "g1-standard",
                    usageAttributionId: "team:ec76db37-9a48-4e2d-a78e-0ec7d2b4d2c0",
                } as any,
                workspace,
            );
            expect(workspace).to.deep.equal(
                {
                    id: "akosyakov-parceldemo-4crqn25qlwi",
                    prebuild: false,
                    organizationId: "ec76db37-9a48-4e2d-a78e-0ec7d2b4d2c0",
                    name: "akosyakov/parcel-demo - master",
                    pinned: false,
                    status: {
                        phase: {
                            name: WorkspacePhase_Phase.STOPPED,
                            lastTransitionTime: Timestamp.fromDate(new Date("2023-10-16T20:36:16.205Z")),
                        },
                        message: "",
                        workspaceUrl:
                            "https://akosyakov-parceldemo-4crqn25qlwi.ws-dev.ak-public-26583c8c5c.preview.gitpod-dev.com",
                        gitStatus: {
                            branch: "ak/test",
                            cloneUrl: "https://github.com/akosyakov/parcel-demo.git",
                            latestCommit: "2203d16573ee3838e6a2a19d5cf678fb706f4885",
                            totalUncommitedFiles: 1,
                            totalUnpushedCommits: 1,
                            totalUntrackedFiles: 0,
                            uncommitedFiles: ["index.js"],
                            unpushedCommits: ["2203d16: tests"],
                            untrackedFiles: [],
                        },
                        ports: [
                            {
                                policy: WorkspacePort_Policy.PUBLIC,
                                port: BigInt(1234),
                                protocol: WorkspacePort_Protocol.HTTP,
                                url: "https://1234-akosyakov-parceldemo-4crqn25qlwi.ws-dev.ak-public-26583c8c5c.preview.gitpod-dev.com",
                            },
                        ],
                        admission: AdmissionLevel.OWNER_ONLY,
                        instanceId: "226695b4-f10a-471a-a219-9b657645bf78",
                        conditions: {
                            failed: "",
                            timeout: "",
                        },
                    },
                    additionalEnvironmentVariables: [],
                    region: "dev",
                    prebuildId: "",
                    workspaceClass: "g1-standard",
                    editor: {
                        name: "code",
                        version: "stable",
                    },
                    contextUrl: "https://github.com/akosyakov/parcel-demo",
                },
                "stopped",
            );
            workspace = converter.toWorkspace(
                {
                    id: "e1148a46-a311-4215-8421-37cd3b907ee9",
                    workspaceId: "akosyakov-parceldemo-4crqn25qlwi",
                    region: "dev",
                    creationTime: "2023-10-16T20:38:42.942Z",
                    startedTime: "2023-10-16T20:38:51.092Z",
                    ideUrl: "https://akosyakov-parceldemo-4crqn25qlwi.ws-dev.ak-public-26583c8c5c.preview.gitpod-dev.com",
                    status: {
                        phase: "running",
                        message: "",
                        timeout: "30m0s",
                        version: 227857,
                        conditions: {
                            failed: "",
                            timeout: "",
                            deployed: true,
                            pullingImages: false,
                            stoppedByRequest: false,
                            firstUserActivity: "2023-10-16T20:38:51.000Z",
                            headlessTaskFailed: "",
                        },
                        exposedPorts: [],
                    },
                    gitStatus: {
                        branch: "ak/test",
                        latestCommit: "2203d16573ee3838e6a2a19d5cf678fb706f4885",
                        uncommitedFiles: ["index.js"],
                        unpushedCommits: ["2203d16: tests"],
                        totalUncommitedFiles: 1,
                        totalUnpushedCommits: 1,
                    },
                    phasePersisted: "running",
                    deleted: false,
                    configuration: {
                        ideImage:
                            "eu.gcr.io/gitpod-core-dev/build/ide/code:commit-e77f3a07ea76bbb404d3f6bf4af36269afc45df1",
                        ideImageLayers: [
                            "eu.gcr.io/gitpod-core-dev/build/ide/gitpod-code-web:commit-49bb715b599dce2356dd02a6ede7ae8cf10d8d12",
                            "eu.gcr.io/gitpod-core-dev/build/ide/code-codehelper:commit-18a48e2ccb779a268355d2b58a167c73de023547",
                        ],
                        supervisorImage:
                            "eu.gcr.io/gitpod-core-dev/build/supervisor:commit-cda78d5706672b9a41e15d84a128cdb24357ad87",
                        ideConfig: {
                            useLatest: false,
                            ide: "code",
                        },
                        ideSetup: {
                            envvars: [
                                {
                                    name: "GITPOD_CONFIGCAT_ENABLED",
                                    value: "true",
                                },
                                {
                                    name: "GITPOD_IDE_ALIAS",
                                    value: "code",
                                },
                            ],
                            tasks: [],
                        },
                        regionPreference: "",
                        fromBackup: true,
                        featureFlags: ["workspace_connection_limiting", "workspace_class_limiting"],
                    },
                    imageBuildInfo: null,
                    workspaceClass: "g1-standard",
                    usageAttributionId: "team:ec76db37-9a48-4e2d-a78e-0ec7d2b4d2c0",
                } as any,
                workspace,
            );
            expect(workspace).to.deep.equal(
                {
                    id: "akosyakov-parceldemo-4crqn25qlwi",
                    prebuild: false,
                    organizationId: "ec76db37-9a48-4e2d-a78e-0ec7d2b4d2c0",
                    name: "akosyakov/parcel-demo - master",
                    pinned: false,
                    status: {
                        phase: {
                            name: WorkspacePhase_Phase.RUNNING,
                            lastTransitionTime: Timestamp.fromDate(new Date("2023-10-16T20:38:51.092Z")),
                        },
                        message: "",
                        workspaceUrl:
                            "https://akosyakov-parceldemo-4crqn25qlwi.ws-dev.ak-public-26583c8c5c.preview.gitpod-dev.com",
                        gitStatus: {
                            branch: "ak/test",
                            cloneUrl: "https://github.com/akosyakov/parcel-demo.git",
                            latestCommit: "2203d16573ee3838e6a2a19d5cf678fb706f4885",
                            totalUncommitedFiles: 1,
                            totalUnpushedCommits: 1,
                            totalUntrackedFiles: 0,
                            uncommitedFiles: ["index.js"],
                            unpushedCommits: ["2203d16: tests"],
                            untrackedFiles: [],
                        },
                        ports: [],
                        admission: AdmissionLevel.OWNER_ONLY,
                        instanceId: "e1148a46-a311-4215-8421-37cd3b907ee9",
                        conditions: {
                            failed: "",
                            timeout: "",
                        },
                    },
                    additionalEnvironmentVariables: [],
                    region: "dev",
                    prebuildId: "",
                    workspaceClass: "g1-standard",
                    editor: {
                        name: "code",
                        version: "stable",
                    },
                    contextUrl: "https://github.com/akosyakov/parcel-demo",
                },
                "restarted",
            );
        });
    });

    describe("toConfiguration", () => {
        it("should convert a Project to a Configuration", () => {
            const project: Project = {
                id: "123",
                teamId: "456",
                name: "My Project",
                cloneUrl: "https://github.com/myorg/myproject.git",
                appInstallationId: "",
                creationTime: new Date().toISOString(),
                settings: {
                    workspaceClasses: {
                        regular: "dev",
                    },
                    prebuilds: {
                        enable: true,
                        branchMatchingPattern: "main",
                        branchStrategy: "default-branch",
                        prebuildInterval: 20,
                        workspaceClass: "dev",
                    },
                },
            };
            const result = converter.toConfiguration(project);
            expect(result.id).to.equal(project.id);
            expect(result.organizationId).to.equal(project.teamId);
            expect(result.name).to.equal(project.name);
            expect(result.cloneUrl).to.equal(project.cloneUrl);
            expect(result.creationTime).to.deep.equal(Timestamp.fromDate(new Date(project.creationTime)));
            expect(result.workspaceSettings).to.deep.equal(
                new WorkspaceSettings({
                    workspaceClass: project.settings?.workspaceClasses?.regular,
                }),
            );
            expect(result.prebuildSettings).to.deep.equal(
                new PrebuildSettings({
                    enabled: project.settings?.prebuilds?.enable,
                    branchMatchingPattern: project.settings?.prebuilds?.branchMatchingPattern,
                    branchStrategy: BranchMatchingStrategy.DEFAULT_BRANCH,
                    prebuildInterval: project.settings?.prebuilds?.prebuildInterval,
                    workspaceClass: project.settings?.prebuilds?.workspaceClass,
                }),
            );
        });
    });

    describe("toPrebuildSettings", () => {
        it("should convert a PrebuildSettingsProtocol to a PrebuildSettings", () => {
            const prebuilds: PrebuildSettingsProtocol = {
                enable: true,
                branchMatchingPattern: "main",
                branchStrategy: "default-branch",
                prebuildInterval: 42,
                workspaceClass: "dev",
            };
            const result = converter.toPrebuildSettings(prebuilds);
            expect(result.enabled).to.equal(prebuilds.enable);
            expect(result.branchMatchingPattern).to.equal(prebuilds.branchMatchingPattern);
            expect(result.branchStrategy).to.equal(BranchMatchingStrategy.DEFAULT_BRANCH);
            expect(result.prebuildInterval).to.equal(prebuilds.prebuildInterval);
            expect(result.workspaceClass).to.equal(prebuilds.workspaceClass);
        });

        it("should return an empty PrebuildSettings if no PrebuildSettingsProtocol is provided", () => {
            const result = converter.toPrebuildSettings(undefined);
            expect(result).to.deep.equal(new PrebuildSettings());
        });
    });

    describe("toBranchMatchingStrategy", () => {
        it("should convert a BranchStrategy to a BranchMatchingStrategy", () => {
            expect(converter.toBranchMatchingStrategy("default-branch")).to.equal(
                BranchMatchingStrategy.DEFAULT_BRANCH,
            );
            expect(converter.toBranchMatchingStrategy("all-branches")).to.equal(BranchMatchingStrategy.ALL_BRANCHES);
            expect(converter.toBranchMatchingStrategy("matched-branches")).to.equal(
                BranchMatchingStrategy.MATCHED_BRANCHES,
            );
            expect(converter.toBranchMatchingStrategy(undefined)).to.equal(BranchMatchingStrategy.DEFAULT_BRANCH);
        });
    });

    describe("toWorkspaceSettings", () => {
        it("should convert a workspace class string to a WorkspaceSettings", () => {
            const workspaceClass = "dev";
            const result = converter.toWorkspaceSettings(workspaceClass);
            expect(result).to.deep.equal(new WorkspaceSettings({ workspaceClass }));
        });

        it("should return an empty WorkspaceSettings if no workspace class string is provided", () => {
            const result = converter.toWorkspaceSettings(undefined);
            expect(result).to.deep.equal(new WorkspaceSettings());
        });
    });

    describe("toAuthProviderDescription", () => {
        const info: AuthProviderInfo = {
            authProviderId: "ap123",
            authProviderType: "GitHub",
            host: "localhost",
            verified: true,
            icon: "unused icon",
            description: "unused description",
            settingsUrl: "unused",
            ownerId: "unused",
            organizationId: "unused",
        };
        const description = new AuthProviderDescription({
            id: info.authProviderId,
            type: AuthProviderType.GITHUB,
            host: info.host,
            icon: info.icon,
            description: info.description,
        });
        it("should convert an auth provider info to a description", () => {
            const result = converter.toAuthProviderDescription(info);
            expect(result).to.deep.equal(description);
        });
    });

    describe("toAuthProvider", () => {
        const entry: AuthProviderEntry = {
            id: "ap123",
            type: "GitHub",
            host: "localhost",
            status: "pending",
            ownerId: "userId",
            organizationId: "orgId123",
            oauth: {
                clientId: "clientId123",
                clientSecret: "should not appear in result",
                callBackUrl: "localhost/callback",
                authorizationUrl: "auth.service/authorize",
                tokenUrl: "auth.service/token",
            },
        };
        const provider = new AuthProvider({
            id: entry.id,
            type: AuthProviderType.GITHUB,
            host: entry.host,
            oauth2Config: {
                clientId: entry.oauth?.clientId,
                clientSecret: entry.oauth?.clientSecret,
            },
            owner: {
                case: "organizationId",
                value: entry.organizationId!,
            },
        });
        it("should convert an auth provider", () => {
            const result = converter.toAuthProvider(entry);
            expect(result).to.deep.equal(provider);
        });
    });

    describe("toAuthProviderType", () => {
        const mapping: { [key: string]: number } = {
            GitHub: AuthProviderType.GITHUB,
            GitLab: AuthProviderType.GITLAB,
            Bitbucket: AuthProviderType.BITBUCKET,
            BitbucketServer: AuthProviderType.BITBUCKET_SERVER,
            Other: AuthProviderType.UNSPECIFIED,
        };
        it("should convert auth provider types", () => {
            for (const k of Object.getOwnPropertyNames(mapping)) {
                const result = converter.toAuthProviderType(k);
                expect(result).to.deep.equal(mapping[k]);
            }
        });
    });

    describe("toWorkspaceEnvironmentVariables", () => {
        const wsCtx: WithEnvvarsContext = {
            title: "title",
            envvars: [
                {
                    name: "FOO",
                    value: "bar",
                },
            ],
        };
        const envVars = [new WorkspaceEnvironmentVariable({ name: "FOO", value: "bar" })];
        it("should convert workspace environment variable types", () => {
            const result = converter.toWorkspaceEnvironmentVariables(wsCtx);
            expect(result).to.deep.equal(envVars);
        });
    });

    describe("toUserEnvironmentVariable", () => {
        const envVar: UserEnvVarValue = {
            id: "1",
            name: "FOO",
            value: "bar",
            repositoryPattern: "*/*",
        };
        const userEnvVar = new UserEnvironmentVariable({
            id: "1",
            name: "FOO",
            value: "bar",
            repositoryPattern: "*/*",
        });
        it("should convert user environment variable types", () => {
            const result = converter.toUserEnvironmentVariable(envVar);
            expect(result).to.deep.equal(userEnvVar);
        });
    });

    describe("toConfigurationEnvironmentVariable", () => {
        const envVar: ProjectEnvVar = {
            id: "1",
            name: "FOO",
            censored: true,
            projectId: "1",
        };
        const userEnvVar = new ConfigurationEnvironmentVariable({
            id: "1",
            name: "FOO",
            admission: EnvironmentVariableAdmission.PREBUILD,
            configurationId: "1",
        });
        it("should convert configuration environment variable types", () => {
            const result = converter.toConfigurationEnvironmentVariable(envVar);
            expect(result).to.deep.equal(userEnvVar);
        });
    });

    describe("toPrebuild", () => {
        it("should convert a prebuild", () => {
            const result = converter.toPrebuild({
                info: {
                    id: "5fba7d7c-e740-4339-b928-0e3c5975eb37",
                    buildWorkspaceId: "akosyakov-parceldemo-pzlbt0c1t2w",
                    teamId: "e13b09f1-19b9-413f-be18-181fe9316816",
                    userId: "8cccf1d0-2ed8-4d54-b141-f633f6008cd3",
                    projectName: "parcel-demo",
                    projectId: "8400828f-99bb-4758-a7d2-f25e88013823",
                    startedAt: "2023-11-17T10:42:00.000Z",
                    startedBy: "",
                    startedByAvatar: "",
                    cloneUrl: "https://github.com/akosyakov/parcel-demo.git",
                    branch: "master",
                    changeAuthor: "Anton Kosyakov",
                    changeAuthorAvatar: "https://avatars.githubusercontent.com/u/3082655?v=4",
                    changeDate: "2021-06-28T10:48:28Z",
                    changeHash: "60dbf818194082ef1a368bacd49cfd25a34c9256",
                    changeTitle: "add open/preview",
                    changeUrl: "https://github.com/akosyakov/parcel-demo/tree/master",
                },
                status: "building",
            });
            expect(result.toJson()).to.deep.equal({
                id: "5fba7d7c-e740-4339-b928-0e3c5975eb37",
                workspaceId: "akosyakov-parceldemo-pzlbt0c1t2w",
                configurationId: "8400828f-99bb-4758-a7d2-f25e88013823",
                ref: "master",
                commit: {
                    author: {
                        avatarUrl: "https://avatars.githubusercontent.com/u/3082655?v=4",
                        name: "Anton Kosyakov",
                    },
                    authorDate: "2021-06-28T10:48:28Z",
                    message: "add open/preview",
                    sha: "60dbf818194082ef1a368bacd49cfd25a34c9256",
                },
                contextUrl: "https://github.com/akosyakov/parcel-demo/tree/master",
                status: {
                    phase: {
                        name: "PHASE_BUILDING",
                    },
                    startTime: "2023-11-17T10:42:00Z",
                },
            });
        });
    });
    describe("toSCMToken", () => {
        it("should convert a token", () => {
            const t1 = new Date();
            const token: Token = {
                scopes: ["foo"],
                value: "secret",
                refreshToken: "refresh!",
                username: "root",
                idToken: "nope",
                expiryDate: t1.toISOString(),
                updateDate: t1.toISOString(),
            };
            expect(converter.toSCMToken(token).toJson()).to.deep.equal({
                expiryDate: t1.toISOString(),
                idToken: "nope",
                refreshToken: "refresh!",
                scopes: ["foo"],
                updateDate: t1.toISOString(),
                username: "root",
                value: "secret",
            });
        });
    });
    describe("toSuggestedRepository", () => {
        it("should convert a repo", () => {
            const repo: SuggestedRepository = {
                url: "https://github.com/gitpod-io/gitpod",
                projectId: "123",
                projectName: "Gitpod",
                repositoryName: "gitpod",
            };
            expect(converter.toSuggestedRepository(repo).toJson()).to.deep.equal({
                url: "https://github.com/gitpod-io/gitpod",
                configurationId: "123",
                configurationName: "Gitpod",
                repoName: "gitpod",
            });
        });
    });
});
