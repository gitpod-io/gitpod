/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import "mocha";
import * as chai from "chai";
import { ConfigInferrer, Context } from "./config-inferrer";
import { WorkspaceConfig } from "@gitpod/gitpod-protocol";

function context(files: { [path: string]: string }): Context {
    const cache = new Set<string>();
    return {
        excludeVsCodeConfig: false,
        config: {},
        exists: async (path: string) => {
            // simulate cache miss
            if (!cache.has(path)) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            cache.add(path);
            return path.toString() in files;
        },
        read: async (path: string) => {
            // simulate cache miss
            if (!cache.has(path)) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            cache.add(path);
            return files[path];
        },
    };
}

async function expect(files: { [path: string]: string }, config: WorkspaceConfig): Promise<void> {
    const cf = new ConfigInferrer();
    const before = Date.now();
    const result = await cf.getConfig(context(files));
    chai.assert.isTrue(
        Date.now() - before < 200,
        "ConfigInferrer should not take longer than 200ms. Took: " + (Date.now() - before),
    );

    chai.assert.equal(JSON.stringify(result, null, "  "), JSON.stringify(config, null, "  "));
}

describe("config serializer", () => {
    it("serialized proper YAML", async () => {
        const config: WorkspaceConfig = {
            tasks: [
                {
                    init: "yarn install",
                    command: "yarn run build",
                },
            ],
            vscode: {
                extensions: ["foo", "bar"],
            },
        };
        const cf = new ConfigInferrer();
        chai.assert.equal(
            cf.toYaml(config),
            `tasks:
  - init: yarn install
    command: yarn run build
vscode:
  extensions:
    - foo
    - bar
`,
        );
    });
});

describe("config inferrer", () => {
    it("[node] yarn", async () =>
        expect(
            {
                "yarn.lock": "",
                "package.json": `
                {
                    "scripts": {
                        "prepare": "yarn run clean && yarn run build",
                        "clean": "npx rimraf lib",
                        "build": "npx tsc",
                        "watch": "npx tsc -w"
                    }
                }`,
            },
            {
                tasks: [
                    {
                        init: "yarn install && yarn run build",
                        command: "yarn run watch",
                    },
                ],
                vscode: {
                    extensions: ["dbaeumer.vscode-eslint"],
                },
            },
        )),
        it("[node] npm", async () =>
            expect(
                {
                    "package.json": `
                    {
                        "scripts": {
                            "clean": "npx rimraf lib",
                            "build": "npx tsc",
                            "watch": "npx tsc -w"
                        }
                    }`,
                },
                {
                    tasks: [
                        {
                            init: "npm install && npm run build",
                            command: "npm run watch",
                        },
                    ],
                    vscode: {
                        extensions: ["dbaeumer.vscode-eslint"],
                    },
                },
            )),
        it("[node] pnpm", async () =>
            expect(
                {
                    "pnpm-lock.yaml": "",
                    "package.json": `
                        {
                            "packageManager": "pnpm@6.32.4",
                            "scripts": {
                                "clean": "npx rimraf lib",
                                "build": "npx tsc",
                                "watch": "npx tsc -w"
                            }
                        }`,
                },
                {
                    tasks: [
                        {
                            init: "pnpm install && pnpm run build",
                            command: "pnpm run watch",
                        },
                    ],
                    vscode: {
                        extensions: ["dbaeumer.vscode-eslint"],
                    },
                },
            )),
        it("[java] mvn wrapper", async () =>
            expect(
                {
                    "pom.xml": "",
                    mvnw: "",
                },
                {
                    tasks: [
                        {
                            init: "./mvnw install -DskipTests=false",
                        },
                    ],
                    vscode: {
                        extensions: ["redhat.java", "vscjava.vscode-java-debug", "vscjava.vscode-maven"],
                    },
                },
            )),
        it("[java] mvn", async () =>
            expect(
                {
                    "pom.xml": "",
                },
                {
                    tasks: [
                        {
                            init: "mvn install -DskipTests=false",
                        },
                    ],
                    vscode: {
                        extensions: ["redhat.java", "vscjava.vscode-java-debug", "vscjava.vscode-maven"],
                    },
                },
            )),
        it("[java] gradle", async () =>
            expect(
                {
                    "build.gradle": "",
                    "pom.xml": "",
                },
                {
                    tasks: [
                        {
                            init: "gradle build",
                        },
                    ],
                    vscode: {
                        extensions: ["redhat.java", "vscjava.vscode-java-debug"],
                    },
                },
            )),
        it("[java] gradle wrapper", async () =>
            expect(
                {
                    "build.gradle": "",
                    gradlew: "",
                },
                {
                    tasks: [
                        {
                            init: "./gradlew build",
                        },
                    ],
                    vscode: {
                        extensions: ["redhat.java", "vscjava.vscode-java-debug"],
                    },
                },
            )),
        it("[kotlin] gradle", async () =>
            expect(
                {
                    "build.gradle.kts": "",
                    "pom.xml": "",
                },
                {
                    tasks: [
                        {
                            init: "gradle build",
                        },
                    ],
                    vscode: {
                        extensions: ["fwcd.kotlin"],
                    },
                },
            )),
        it("[kotlin] gradle wrapper", async () =>
            expect(
                {
                    "build.gradle.kts": "",
                    gradlew: "",
                },
                {
                    tasks: [
                        {
                            init: "./gradlew build",
                        },
                    ],
                    vscode: {
                        extensions: ["fwcd.kotlin"],
                    },
                },
            )),
        it("[python] pip install", async () =>
            expect(
                {
                    "requirements.txt": "",
                },
                {
                    tasks: [
                        {
                            init: "pip install -r requirements.txt",
                        },
                    ],
                    vscode: {
                        extensions: ["ms-python.python"],
                    },
                },
            )),
        it("[go] go install", async () =>
            expect(
                {
                    "go.mod": "",
                },
                {
                    tasks: [
                        {
                            init: "go get && go build ./... && go test ./...",
                            command: "go run .",
                        },
                    ],
                    vscode: {
                        extensions: ["golang.go"],
                    },
                },
            )),
        it("[rust] cargo", async () =>
            expect(
                {
                    "Cargo.toml": "",
                },
                {
                    tasks: [
                        {
                            init: "cargo build",
                            command: "cargo watch -x run",
                        },
                    ],
                    vscode: {
                        extensions: ["matklad.rust-analyzer"],
                    },
                },
            )),
        it("[make] make", async () =>
            expect(
                {
                    Makefile: "",
                },
                {
                    tasks: [
                        {
                            init: "make",
                        },
                    ],
                },
            )),
        it("[make] cmake", async () =>
            expect(
                {
                    "CMakeLists.txt": "",
                },
                {
                    tasks: [
                        {
                            init: "cmake .",
                        },
                    ],
                },
            )),
        it("[dotnet] nuget", async () =>
            expect(
                {
                    "packages.config": "",
                },
                {
                    tasks: [
                        {
                            init: "nuget install",
                        },
                    ],
                },
            )),
        it("[ruby] gemfile", async () =>
            expect(
                {
                    Gemfile: "",
                },
                {
                    tasks: [
                        {
                            init: "bundle install",
                        },
                    ],
                },
            ));
});
