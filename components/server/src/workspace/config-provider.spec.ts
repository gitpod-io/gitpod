/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
import "reflect-metadata";
import { suite, test } from "@testdeck/mocha";
import * as chai from "chai";
import { ConfigProvider } from "./config-provider";
import { Container, ContainerModule } from "inversify";
import { GitpodFileParser } from "@gitpod/gitpod-protocol/lib/gitpod-file-parser";
import { HostContextProvider } from "../auth/host-context-provider";
import { ConfigurationService } from "../config/configuration-service";
import { TeamDB } from "@gitpod/gitpod-db/lib";
import { Config } from "../config";
import { AuthorizationService } from "../user/authorization-service";
import { EntitlementService } from "../billing/entitlement-service";
import { User } from "@gitpod/gitpod-protocol";
const expect = chai.expect;
const baseUserInfo: User = {
    id: "1",
    creationDate: "today :)",
    identities: [],
    name: "John Doe",
};
const globalDefaultImage = "gitpod/global-default";
const baseOrgImage = "gitpod/org-default";
const baseYamlImage = "gitpod/yml";

const orgDefaultImageMap: Record<string, string | undefined> = {
    ORG: baseOrgImage,
    NONE: undefined,
};

@suite
class TestConfigProvider {
    private container = new Container();
    public before() {
        this.container.load(
            new ContainerModule((bind, unbind, isBound, rebind) => {
                bind(GitpodFileParser).toSelf().inSingletonScope();
                bind(ConfigProvider).toSelf().inSingletonScope();
                bind(HostContextProvider).toConstantValue({
                    get(hostname: string) {
                        return {
                            authProvider(hostname: string) {
                                return hostname;
                            },
                            services: {
                                fileProvider: {
                                    getGitpodFileContent: async () => {
                                        return hostname === "HAS_IMAGE" ? `image: ${baseYamlImage}` : undefined;
                                    },
                                    getFileContent: async () => {
                                        return hostname === "HAS_IMAGE" ? `image: ${baseYamlImage}` : undefined;
                                    },
                                },
                            },
                        };
                    },
                });
                bind(AuthorizationService).toConstantValue({});
                bind(EntitlementService).toConstantValue({});
                bind(ConfigurationService).toSelf().inSingletonScope();
                bind(Config).toConstantValue({
                    workspaceDefaults: {
                        workspaceImage: globalDefaultImage,
                    },
                });
                bind(TeamDB).toConstantValue({
                    async findOrgSettings(teamId: string) {
                        return {
                            defaultWorkspaceImage: orgDefaultImageMap[teamId],
                        };
                    },
                });
            }),
        );
    }

    @test
    public async testGetDefaultImage() {
        const configProvider = this.container.get(ConfigProvider);
        const image = await configProvider.getDefaultImage("ORG");
        expect(image).to.equal(baseOrgImage);
    }

    @test
    public async testGetDefaultImageWithoutOrgID() {
        const configProvider = this.container.get(ConfigProvider);
        const image = await configProvider.getDefaultImage();
        expect(image).to.equal(globalDefaultImage);
    }

    @test
    public async testGetDefaultImageWithoutOrgDefaultImage() {
        const configProvider = this.container.get(ConfigProvider);
        const image = await configProvider.getDefaultImage("NONE");
        expect(image).to.equal(globalDefaultImage);
    }

    @test
    public async testFetchConfigWithOrgImageAndCustomizedImage() {
        const configProvider = this.container.get(ConfigProvider);
        const data = await configProvider.fetchConfig(
            {},
            baseUserInfo,
            { repository: { host: "HAS_IMAGE" } } as any,
            "ORG",
        );
        expect(data.config.image).to.equal(baseYamlImage);
    }

    @test
    public async testFetchConfigWithOrgImageAndWithoutCustomizedImage() {
        const configProvider = this.container.get(ConfigProvider);
        const data = await configProvider.fetchConfig({}, baseUserInfo, { repository: { host: "NONE" } } as any, "ORG");
        expect(data.config.image).to.equal(baseOrgImage);
    }

    @test
    public async testFetchConfigWithoutOrgImageAndWithoutCustomizedImage() {
        const configProvider = this.container.get(ConfigProvider);
        const data = await configProvider.fetchConfig(
            {},
            baseUserInfo,
            { repository: { host: "NONE" } } as any,
            "NONE",
        );
        expect(data.config.image).to.equal(globalDefaultImage);
    }

    @test
    public async testFetchConfigWithoutOrgImageAndCustomizedImage() {
        const configProvider = this.container.get(ConfigProvider);
        const data = await configProvider.fetchConfig(
            {},
            baseUserInfo,
            { repository: { host: "HAS_IMAGE" } } as any,
            "ORG",
        );
        expect(data.config.image).to.equal(baseYamlImage);
    }
}

module.exports = new TestConfigProvider();
