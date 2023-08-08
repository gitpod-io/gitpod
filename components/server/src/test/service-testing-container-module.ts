/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { IAnalyticsWriter, NullAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { IDEServiceDefinition } from "@gitpod/ide-service-api/lib/ide.pb";
import { UsageServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { WorkspaceManagerClientProvider } from "@gitpod/ws-manager/lib/client-provider";
import { ContainerModule } from "inversify";
import { v4 } from "uuid";
import { AuthProviderParams } from "../auth/auth-provider";
import { HostContextProviderFactory } from "../auth/host-context-provider";
import { HostContextProviderImpl } from "../auth/host-context-provider-impl";
import { SpiceDBClient } from "../authorization/spicedb";
import { Config } from "../config";
import { StorageClient } from "../storage/storage-client";
import { testContainer } from "@gitpod/gitpod-db/lib";
import { productionContainerModule } from "../container-module";
import { createMock } from "./mocks/mock";
import { UsageServiceClientMock } from "./mocks/usage-service-client-mock";
import { env } from "process";

/**
 * Expects a fully configured production container and
 *  - replaces all services to external APIs with mocks
 *  - replaces the config with a mock config
 *  - replaces the analytics writer with a null analytics writer
 */
const mockApplyingContainerModule = new ContainerModule((bind, unbound, isbound, rebind) => {
    rebind(UsageServiceDefinition.name).toConstantValue(createMock(new UsageServiceClientMock()));
    rebind(StorageClient).toConstantValue(createMock());
    rebind(WorkspaceManagerClientProvider).toConstantValue(createMock());
    rebind(IDEServiceDefinition.name).toConstantValue(createMock());

    rebind<Partial<Config>>(Config).toConstantValue({
        blockNewUsers: {
            enabled: false,
            passlist: [],
        },
        redis: {
            address: (env.REDIS_HOST || "127.0.0.1") + ":" + (env.REDIS_PORT || "6379"),
        },
    });
    rebind(IAnalyticsWriter).toConstantValue(NullAnalyticsWriter);
    rebind(HostContextProviderFactory)
        .toDynamicValue(({ container }) => ({
            createHostContext: (config: AuthProviderParams) =>
                HostContextProviderImpl.createHostContext(container, config),
        }))
        .inSingletonScope();

    rebind(SpiceDBClient)
        .toDynamicValue(() => {
            const token = v4();
            return v1.NewClient(token, "localhost:50051", v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS).promises;
        })
        .inSingletonScope();
});

/**
 *
 * @returns a container that is configured for testing and assumes a running DB, spiceDB and redis
 */
export function createTestContainer() {
    const container = testContainer.createChild();
    container.load(productionContainerModule);
    container.load(mockApplyingContainerModule);
    return container;
}
