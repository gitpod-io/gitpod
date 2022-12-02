/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { ContainerModule } from "inversify";

import { ChargebeeProvider, ChargebeeProviderOptions } from "./chargebee/chargebee-provider";
import { EndpointController } from "./chargebee/endpoint-controller";
import { SubscriptionService } from "./accounting/subscription-service";
import { Config } from "./config";
import { Server } from "./server";
import { SubscriptionHandler } from "./chargebee/subscription-handler";
import { SubscriptionMapper } from "./chargebee/subscription-mapper";
import { TeamSubscriptionHandler } from "./chargebee/team-subscription-handler";
import { CompositeEventHandler, EventHandler } from "./chargebee/chargebee-event-handler";
import { UpgradeHelper } from "./chargebee/upgrade-helper";
import { TeamSubscriptionService } from "./accounting/team-subscription-service";
import { TeamSubscription2Service } from "./accounting/team-subscription2-service";
import { AccountService } from "./accounting/account-service";
import { AccountServiceImpl } from "./accounting/account-service-impl";
import { GithubEndpointController } from "./github/endpoint-controller";
import { GithubSubscriptionMapper } from "./github/subscription-mapper";
import { GithubSubscriptionReconciler } from "./github/subscription-reconciler";
import { UsageServiceClient, UsageServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { createChannel, createClient } from "nice-grpc";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

export const productionContainerModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(Config).toSelf().inSingletonScope();
    bind(Server).toSelf().inSingletonScope();

    bind(EndpointController).toSelf().inSingletonScope();
    bind(SubscriptionHandler).toSelf().inSingletonScope();
    bind(SubscriptionMapper).toSelf().inSingletonScope();
    bind(TeamSubscriptionHandler).toSelf().inSingletonScope();

    bind(CompositeEventHandler).toSelf().inSingletonScope();
    bind(EventHandler).to(SubscriptionHandler).inSingletonScope();
    bind(EventHandler).to(TeamSubscriptionHandler).inSingletonScope();

    bind(SubscriptionService).toSelf().inSingletonScope();
    bind(TeamSubscriptionService).toSelf().inSingletonScope();
    bind(TeamSubscription2Service).toSelf().inSingletonScope();
    bind(AccountService).to(AccountServiceImpl).inSingletonScope();

    bind(ChargebeeProvider).toSelf().inSingletonScope();
    bind(ChargebeeProviderOptions)
        .toDynamicValue((ctx) => {
            const config = ctx.container.get(Config);
            return config.chargebeeProviderOptions;
        })
        .inSingletonScope();
    bind(UpgradeHelper).toSelf().inSingletonScope();

    bind(GithubEndpointController).toSelf().inSingletonScope();
    bind(GithubSubscriptionMapper).toSelf().inSingletonScope();
    bind(GithubSubscriptionReconciler).toSelf().inSingletonScope();

    bind<UsageServiceClient>(UsageServiceDefinition.name)
        .toDynamicValue((ctx) => {
            const config = ctx.container.get<Config>(Config);
            log.info("Connecting to usage service at", { addr: config.usageServiceAddr });
            return createClient(UsageServiceDefinition, createChannel(config.usageServiceAddr));
        })
        .inSingletonScope();
});
