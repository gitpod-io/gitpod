/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { IDEOption, IDEOptions } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import * as chai from "chai";
import { migrationIDESettings, chooseIDE } from "./workspace-starter";
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
});
