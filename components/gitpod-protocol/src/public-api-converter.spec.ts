/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Timestamp } from "@bufbuild/protobuf";
import {
    AdmissionLevel,
    WorkspacePhase_Phase,
    WorkspacePort_Policy,
    WorkspacePort_Protocol,
} from "@gitpod/public-api/lib/gitpod/experimental/v2/workspace_pb";
import { suite, test } from "@testdeck/mocha";
import { expect } from "chai";
import { PublicAPIConverter } from "./public-api-converter";

@suite
export class TestPublicAPIConverter {
    private readonly converter = new PublicAPIConverter();

    @test public testToWorkspace() {
        let workspace = this.converter.toWorkspace({
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
                workspaceClass: "g1-standard",
                editor: {
                    name: "code",
                    version: "stable",
                },
                contextUrl: "https://github.com/akosyakov/parcel-demo",
            },
            "created",
        );

        workspace = this.converter.toWorkspace(
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
                workspaceClass: "g1-standard",
                editor: {
                    name: "code",
                    version: "stable",
                },
                contextUrl: "https://github.com/akosyakov/parcel-demo",
            },
            "running",
        );

        workspace = this.converter.toWorkspace(
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
                workspaceClass: "g1-standard",
                editor: {
                    name: "code",
                    version: "stable",
                },
                contextUrl: "https://github.com/akosyakov/parcel-demo",
            },
            "stopped",
        );

        workspace = this.converter.toWorkspace(
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
                workspaceClass: "g1-standard",
                editor: {
                    name: "code",
                    version: "stable",
                },
                contextUrl: "https://github.com/akosyakov/parcel-demo",
            },
            "restarted",
        );
    }
}
