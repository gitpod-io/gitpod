/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ContainerModule } from "inversify";

import { WorkspaceDB } from "./workspace-db";
import { TypeORMWorkspaceDBImpl } from "./typeorm/workspace-db-impl";
import { TypeORMUserDBImpl } from "./typeorm/user-db-impl";
import { UserDB } from "./user-db";
import { Config } from "./config";
import { TypeORM } from "./typeorm/typeorm";
import { encryptionModule } from "@gitpod/gitpod-protocol/lib/encryption/container-module";
import { KeyProviderImpl, KeyProviderConfig } from "@gitpod/gitpod-protocol/lib/encryption/key-provider";
import { DBWithTracing, bindDbWithTracing, TracedWorkspaceDB, TracedUserDB, TracedOneTimeSecretDB } from "./traced-db";
import { OneTimeSecretDB } from "./one-time-secret-db";
import { TypeORMAppInstallationDBImpl } from "./typeorm/app-installation-db-impl";
import { AppInstallationDB } from "./app-installation-db";
import { TypeORMOneTimeSecretDBImpl } from "./typeorm/one-time-secret-db-impl";
import { GitpodTableDescriptionProvider, TableDescriptionProvider } from "./tables";
import { PeriodicDbDeleter } from "./periodic-deleter";
import { CodeSyncResourceDB } from "./typeorm/code-sync-resource-db";

import { WorkspaceClusterDBImpl } from "./typeorm/workspace-cluster-db-impl";
import { WorkspaceClusterDB } from "./workspace-cluster-db";
import { AuthCodeRepositoryDB } from "./typeorm/auth-code-repository-db";
import { AuthProviderEntryDB } from "./auth-provider-entry-db";
import { AuthProviderEntryDBImpl } from "./typeorm/auth-provider-entry-db-impl";
import { EmailDomainFilterDB } from "./email-domain-filter-db";
import { EmailDomainFilterDBImpl } from "./typeorm/email-domain-filter-db-impl";
import { TeamDB } from "./team-db";
import { TeamDBImpl } from "./typeorm/team-db-impl";
import { ProjectDB } from "./project-db";
import { ProjectDBImpl } from "./typeorm/project-db-impl";
import { PersonalAccessTokenDB } from "./personal-access-token-db";
import { TypeORMBlockedRepositoryDBImpl } from "./typeorm/blocked-repository-db-impl";
import { BlockedRepositoryDB } from "./blocked-repository-db";
import { WebhookEventDB } from "./webhook-event-db";
import { WebhookEventDBImpl } from "./typeorm/webhook-event-db-impl";
import { PersonalAccessTokenDBImpl } from "./typeorm/personal-access-token-db-impl";
import { LinkedInProfileDBImpl } from "./typeorm/linked-in-profile-db-impl";
import { LinkedInProfileDB } from "./linked-in-profile-db";
import { DataCache, DataCacheNoop } from "./data-cache";
import { TracingManager } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { EncryptionService, GlobalEncryptionService } from "@gitpod/gitpod-protocol/lib/encryption/encryption-service";
import { annotateMeasurement } from "@gitpod/gitpod-protocol/lib/util/measure";

// THE DB container module that contains all DB implementations
export const dbContainerModule = (cacheClass = DataCacheNoop) =>
    new ContainerModule((bind, unbind, isBound, rebind, unbindAsync, onActivation, onDeactivation) => {
        bind(Config).toSelf().inSingletonScope();
        bind(TypeORM)
            .toSelf()
            .inSingletonScope()
            .onActivation((ctx, orm) => {
                // HACK we need to initialize the global encryption service.
                GlobalEncryptionService.encryptionService = ctx.container.get(EncryptionService);
                return orm;
            });
        bind(DBWithTracing).toSelf().inSingletonScope();
        bind(TracingManager).toSelf().inSingletonScope();
        bind(DataCache).to(cacheClass).inSingletonScope();

        bind(TypeORMBlockedRepositoryDBImpl).toSelf().inSingletonScope();
        bind(BlockedRepositoryDB).toService(TypeORMBlockedRepositoryDBImpl);

        bind(TypeORMUserDBImpl).toSelf().inSingletonScope().onActivation(annotateMeasurement);
        bind(UserDB).toService(TypeORMUserDBImpl);
        bindDbWithTracing(TracedUserDB, bind, UserDB).inSingletonScope();

        bind(AuthProviderEntryDB).to(AuthProviderEntryDBImpl).inSingletonScope();

        bind(TypeORMWorkspaceDBImpl).toSelf().inSingletonScope().onActivation(annotateMeasurement);
        bind(WorkspaceDB).toService(TypeORMWorkspaceDBImpl);
        bindDbWithTracing(TracedWorkspaceDB, bind, WorkspaceDB).inSingletonScope();

        bind(TypeORMAppInstallationDBImpl).toSelf().inSingletonScope().onActivation(annotateMeasurement);
        bind(AppInstallationDB).toService(TypeORMAppInstallationDBImpl);

        bind(TypeORMOneTimeSecretDBImpl).toSelf().inSingletonScope().onActivation(annotateMeasurement);
        bind(OneTimeSecretDB).toService(TypeORMOneTimeSecretDBImpl);
        bindDbWithTracing(TracedOneTimeSecretDB, bind, OneTimeSecretDB).inSingletonScope();

        encryptionModule(bind, unbind, isBound, rebind, unbindAsync, onActivation, onDeactivation);
        bind(KeyProviderConfig)
            .toDynamicValue((ctx) => {
                const config = ctx.container.get<Config>(Config);
                return {
                    keys: KeyProviderImpl.loadKeyConfigFromJsonString(config.dbEncryptionKeys),
                };
            })
            .inSingletonScope();

        bind(GitpodTableDescriptionProvider).toSelf().inSingletonScope();
        bind(TableDescriptionProvider).toService(GitpodTableDescriptionProvider);
        bind(PeriodicDbDeleter).toSelf().inSingletonScope();

        bind(CodeSyncResourceDB).toSelf().inSingletonScope().onActivation(annotateMeasurement);

        bind<WorkspaceClusterDB>(WorkspaceClusterDB)
            .to(WorkspaceClusterDBImpl)
            .inSingletonScope()
            .onActivation(annotateMeasurement);

        bind(AuthCodeRepositoryDB).toSelf().inSingletonScope().onActivation(annotateMeasurement);

        bind(TeamDBImpl).toSelf().inSingletonScope().onActivation(annotateMeasurement);
        bind(TeamDB).toService(TeamDBImpl);
        bind(ProjectDBImpl).toSelf().inSingletonScope().onActivation(annotateMeasurement);
        bind(ProjectDB).toService(ProjectDBImpl);
        bind(WebhookEventDBImpl).toSelf().inSingletonScope().onActivation(annotateMeasurement);
        bind(WebhookEventDB).toService(WebhookEventDBImpl);

        bind(PersonalAccessTokenDBImpl).toSelf().inSingletonScope().onActivation(annotateMeasurement);
        bind(PersonalAccessTokenDB).toService(PersonalAccessTokenDBImpl);

        // com concerns
        bind<EmailDomainFilterDB>(EmailDomainFilterDB)
            .to(EmailDomainFilterDBImpl)
            .inSingletonScope()
            .onActivation(annotateMeasurement);
        bind(LinkedInProfileDBImpl).toSelf().inSingletonScope().onActivation(annotateMeasurement);
        bind(LinkedInProfileDB).toService(LinkedInProfileDBImpl);
    });
