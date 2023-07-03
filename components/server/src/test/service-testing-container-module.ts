/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ContainerModule } from "inversify";
import { OrganizationService } from "../orgs/organization-service";
import { ProjectsService } from "../projects/projects-service";
import { Config } from "../config";
import { AuthProviderService } from "../auth/auth-provider-service";
import { IAnalyticsWriter, NullAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { HostContainerMapping } from "../auth/host-container-mapping";
import { HostContextProvider, HostContextProviderFactory } from "../auth/host-context-provider";
import { AuthProviderParams } from "../auth/auth-provider";
import { HostContextProviderImpl } from "../auth/host-context-provider-impl";
import { SpiceDBClient } from "../authorization/spicedb";
import { SpiceDBAuthorizer } from "../authorization/spicedb-authorizer";
import { Authorizer } from "../authorization/authorizer";
import { v1 } from "@authzed/authzed-node";
import { v4 } from "uuid";

export const serviceTestingContainerModule = new ContainerModule((bind) => {
    bind(OrganizationService).toSelf().inSingletonScope();
    bind(ProjectsService).toSelf().inSingletonScope();
    bind(Config).toConstantValue({});
    bind(AuthProviderService).toSelf().inSingletonScope();
    bind(IAnalyticsWriter).toConstantValue(NullAnalyticsWriter);
    // hostcontext
    bind(HostContainerMapping).toSelf().inSingletonScope();
    bind(HostContextProviderFactory)
        .toDynamicValue(({ container }) => ({
            createHostContext: (config: AuthProviderParams) =>
                HostContextProviderImpl.createHostContext(container, config),
        }))
        .inSingletonScope();
    bind(HostContextProvider).to(HostContextProviderImpl).inSingletonScope();

    bind(SpiceDBClient)
        .toDynamicValue(() => {
            const token = v4();
            return v1.NewClient(token, "localhost:50051", v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS).promises;
        })
        .inSingletonScope();
    bind(SpiceDBAuthorizer).toSelf().inSingletonScope();
    bind(Authorizer).toSelf().inSingletonScope();
});
