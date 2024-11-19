// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

import { expect, test, mock, describe } from "bun:test";
import { JetBrainsIDE, getStableVersionsInfo } from "./jb-stable-version";
import { SemVer } from "semver";

describe("stableVersion", () => {
    const testIdes: JetBrainsIDE[] = [
        {
            productName: "IntelliJ IDEA Ultimate",
            productId: "intellij",
            productCode: "IIU",
            productType: "release",
            exampleRepo: "https://github.com/gitpod-samples/spring-petclinic",
        },
        {
            productName: "GoLand",
            productId: "goland",
            productCode: "GO",
            productType: "release",
            exampleRepo: "https://github.com/gitpod-samples/template-golang-cli",
        },
    ];

    interface args {
        IUBuildVersion: string;
        IUMajorVersion: string;
        GOBuildVersion: string;
        GOMajorVersion: string;
    }
    interface expect {
        err?: string;
        buildVersion?: SemVer;
        majorVersion?: string;
    }

    const toAxiosData = (ide: JetBrainsIDE, majorVersion: string, buildVersion: string) => [
        {
            name: ide.productName,
            link: ide.productCode,
            releases: [
                {
                    majorVersion: majorVersion,
                    build: buildVersion,
                    downloads: {
                        linux: { link: ide.productCode },
                    },
                },
            ],
        },
    ];

    test("getStableVersionsInfo", async () => {
        const tests: { name: string; args: args; expect: expect }[] = [
            {
                name: "happy path",
                args: {
                    IUBuildVersion: "2024.1.1",
                    IUMajorVersion: "2024.1",

                    GOBuildVersion: "2024.1.1",
                    GOMajorVersion: "2024.1",
                },
                expect: { err: undefined, buildVersion: new SemVer("2024.1.1"), majorVersion: "2024.1" },
            },
            {
                name: "happy path with minimal build version",
                args: {
                    IUBuildVersion: "2024.1.300",
                    IUMajorVersion: "2024.1",

                    GOBuildVersion: "2024.2.200",
                    GOMajorVersion: "2024.1",
                },
                expect: { err: undefined, buildVersion: new SemVer("2024.1.300"), majorVersion: "2024.1" },
            },
            {
                name: "happy path with minimal build version#2",
                args: {
                    IUBuildVersion: "2024.20.300",
                    IUMajorVersion: "2024.1",

                    GOBuildVersion: "2024.2.200",
                    GOMajorVersion: "2024.1",
                },
                expect: { err: undefined, buildVersion: new SemVer("2024.2.200"), majorVersion: "2024.1" },
            },
            {
                name: "happy path with minimal build version#3",
                args: {
                    IUBuildVersion: "2024.1.300",
                    IUMajorVersion: "2024.1",

                    GOBuildVersion: "2024.1.1200",
                    GOMajorVersion: "2024.1",
                },
                expect: { err: undefined, buildVersion: new SemVer("2024.1.300"), majorVersion: "2024.1" },
            },
            {
                name: "multiple major versions",
                args: {
                    IUBuildVersion: "2024.1.300",
                    IUMajorVersion: "2024.1",

                    GOBuildVersion: "2024.2.200",
                    GOMajorVersion: "2024.2",
                },
                expect: { err: "Multiple major versions found, skipping update: 2024.1, 2024.2" },
            },
            {
                name: "multiple build versions",
                args: {
                    IUBuildVersion: "2024.1.300",
                    IUMajorVersion: "2024.1",

                    GOBuildVersion: "2025.2.200",
                    GOMajorVersion: "2024.1",
                },
                expect: { err: "Multiple build versions (major) found, skipping update: 2024, 2025" },
            },
        ];
        for (const tt of tests) {
            mock.module("axios", () => ({
                default: (url: string) => {
                    if (url.includes("IIU")) {
                        return {
                            data: toAxiosData(testIdes[0], tt.args.IUMajorVersion, tt.args.IUBuildVersion),
                        };
                    } else if (url.includes("GO")) {
                        return {
                            data: toAxiosData(testIdes[1], tt.args.GOMajorVersion, tt.args.GOBuildVersion),
                        };
                    }
                },
            }));

            if (tt.expect.err) {
                expect(() => getStableVersionsInfo(testIdes)).toThrow(tt.expect.err);
            } else if (tt.expect.buildVersion && tt.expect.majorVersion) {
                const got = await getStableVersionsInfo(testIdes);
                expect(got.majorVersion).toBe(tt.expect.majorVersion);
                expect(String(got.buildVersion)).toBe(String(tt.expect.buildVersion));
            }
        }
    });
});
