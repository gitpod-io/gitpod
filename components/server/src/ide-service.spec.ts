/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import * as chai from "chai";
import { IDEService } from "./ide-service";
import { IDESettingsVersion } from "@gitpod/gitpod-protocol/lib/ide-protocol";
const expect = chai.expect;

describe("ide-service", function () {
    describe("migrateSettings", function () {
        const ideService = new IDEService();
        it("with no ideSettings should be undefined", function () {
            const user: User = {
                id: "string",

                creationDate: "string",
                identities: [],
                additionalData: {},
            };
            const result = ideService.migrateSettings(user);
            expect(result).to.undefined;
        });

        it("with settingVersion 2.0 should be latest", function () {
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
            const result = ideService.migrateSettings(user);
            expect(result).to.deep.equal({
                settingVersion: IDESettingsVersion,
                defaultIde: "code",
                useLatestVersion: true,
            });
        });

        it("with settingVersion 2.0 should be latest and remove intellij-previous", function () {
            const user: User = {
                id: "string",
                creationDate: "string",
                identities: [],
                additionalData: {
                    ideSettings: {
                        settingVersion: "2.0",
                        defaultIde: "intellij-previous",
                        useDesktopIde: false,
                    },
                },
            };
            const result = ideService.migrateSettings(user);
            expect(result).to.deep.equal({
                settingVersion: IDESettingsVersion,
                defaultIde: "code",
                useLatestVersion: false,
            });
        });

        it("with settingVersion latest should be undefined", function () {
            const user: User = {
                id: "string",
                creationDate: "string",
                identities: [],
                additionalData: {
                    ideSettings: {
                        settingVersion: IDESettingsVersion,
                        defaultIde: "code-latest",
                        useDesktopIde: false,
                    },
                },
            };
            const result = ideService.migrateSettings(user);
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
            const result = ideService.migrateSettings(user);
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
            const result = ideService.migrateSettings(user);
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
            const result = ideService.migrateSettings(user);
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
            const result = ideService.migrateSettings(user);
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
            const result = ideService.migrateSettings(user);
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
            const result = ideService.migrateSettings(user);
            expect(result?.defaultIde).to.equal("code");
            expect(result?.useLatestVersion ?? false).to.be.true;
        });
    });
});
