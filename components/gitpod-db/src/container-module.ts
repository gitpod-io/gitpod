/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ContainerModule } from "inversify";

import { WorkspaceDB } from "./workspace-db";
import { TypeORMWorkspaceDBImpl, TransactionalWorkspaceDbImpl } from "./typeorm/workspace-db-impl";
import { TypeORMUserDBImpl } from "./typeorm/user-db-impl";
import { UserDB } from "./user-db";
import { Config } from "./config";
import { UserStorageResourcesDB } from "./user-storage-resources-db";
import { TypeORMUserStorageResourcesDBImpl } from "./typeorm/user-storage-resources-db-impl";
import { TypeORM } from "./typeorm/typeorm";
import { encryptionModule } from "@gitpod/gitpod-protocol/lib/encryption/container-module";
import { KeyProviderImpl, KeyProviderConfig } from "@gitpod/gitpod-protocol/lib/encryption/key-provider";
import { DBWithTracing, bindDbWithTracing, TracedWorkspaceDB, TracedUserDB, TracedOneTimeSecretDB } from "./traced-db";
import { OneTimeSecretDB } from "./one-time-secret-db";
import { TypeORMAppInstallationDBImpl } from "./typeorm/app-installation-db-impl";
import { AppInstallationDB } from "./app-installation-db";
import { TypeORMOneTimeSecretDBImpl } from "./typeorm/one-time-secret-db-impl";
import { PendingGithubEventDB, TransactionalPendingGithubEventDBFactory } from "./pending-github-event-db";
import {
    TransactionalPendingGithubEventDBImpl,
    TypeORMPendingGithubEventDBImpl,
} from "./typeorm/pending-github-event-db-impl";
import { GitpodTableDescriptionProvider, TableDescriptionProvider } from "./tables";
import { PeriodicDbDeleter } from "./periodic-deleter";
import { CodeSyncResourceDB } from "./typeorm/code-sync-resource-db";

import { WorkspaceClusterDBImpl } from "./typeorm/workspace-cluster-db-impl";
import { WorkspaceClusterDB } from "./workspace-cluster-db";
import { AuthCodeRepositoryDB } from "./typeorm/auth-code-repository-db";
import { AuthProviderEntryDB } from "./auth-provider-entry-db";
import { AuthProviderEntryDBImpl } from "./typeorm/auth-provider-entry-db-impl";
import { TeamSubscriptionDB } from "./team-subscription-db";
import { AccountingDB, TransactionalAccountingDBFactory } from "./accounting-db";
import { EmailDomainFilterDB } from "./email-domain-filter-db";
import { EduEmailDomainDB } from "./edu-email-domain-db";
import { EduEmailDomainDBImpl } from "./typeorm/edu-email-domain-db-impl";
import { EmailDomainFilterDBImpl } from "./typeorm/email-domain-filter-db-impl";
import { TeamSubscriptionDBImpl } from "./typeorm/team-subscription-db-impl";
import { TransactionalAccountingDBImpl, TypeORMAccountingDBImpl } from "./typeorm/accounting-db-impl";
import { TeamDB } from "./team-db";
import { TeamDBImpl } from "./typeorm/team-db-impl";
import { ProjectDB } from "./project-db";
import { ProjectDBImpl } from "./typeorm/project-db-impl";
import { PersonalAccessTokenDB } from "./personal-access-token-db";
import { EntityManager } from "typeorm";
import { TypeORMInstallationAdminImpl } from "./typeorm/installation-admin-db-impl";
import { InstallationAdminDB } from "./installation-admin-db";
import { TeamSubscription2DB } from "./team-subscription-2-db";
import { TeamSubscription2DBImpl } from "./typeorm/team-subscription-2-db-impl";
import { TypeORMBlockedRepositoryDBImpl } from "./typeorm/blocked-repository-db-impl";
import { BlockedRepositoryDB } from "./blocked-repository-db";
import { WebhookEventDB } from "./webhook-event-db";
import { WebhookEventDBImpl } from "./typeorm/webhook-event-db-impl";
import { PersonalAccessTokenDBImpl } from "./typeorm/personal-access-token-db-impl";
import { UserToTeamMigrationService } from "./user-to-team-migration-service";
import { Synchronizer } from "./typeorm/synchronizer";
import { WorkspaceOrganizationIdMigration } from "./long-running-migration/workspace-organizationid-migration";
import { LongRunningMigration, LongRunningMigrationService } from "./long-running-migration/long-running-migration";
import { LinkedInProfileDBImpl } from "./typeorm/linked-in-profile-db-impl";
import { LinkedInProfileDB } from "./linked-in-profile-db";

// THE DB container module that contains all DB implementations
export const dbContainerModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(Config).toSelf().inSingletonScope();
    bind(TypeORM).toSelf().inSingletonScope();
    bind(DBWithTracing).toSelf().inSingletonScope();
    bind(TransactionalWorkspaceDbImpl).toSelf().inSingletonScope();

    bind(TypeORMBlockedRepositoryDBImpl).toSelf().inSingletonScope();
    bind(BlockedRepositoryDB).toService(TypeORMBlockedRepositoryDBImpl);

    bind(TypeORMUserDBImpl).toSelf().inSingletonScope();
    bind(UserDB).toService(TypeORMUserDBImpl);
    bindDbWithTracing(TracedUserDB, bind, UserDB).inSingletonScope();

    bind(TypeORMInstallationAdminImpl).toSelf().inSingletonScope();
    bind(InstallationAdminDB).toService(TypeORMInstallationAdminImpl);

    bind(AuthProviderEntryDB).to(AuthProviderEntryDBImpl).inSingletonScope();

    bind(TypeORMWorkspaceDBImpl).toSelf().inSingletonScope();
    bind(WorkspaceDB).toService(TypeORMWorkspaceDBImpl);
    bindDbWithTracing(TracedWorkspaceDB, bind, WorkspaceDB).inSingletonScope();

    bind(TypeORMUserStorageResourcesDBImpl).toSelf().inSingletonScope();
    bind(UserStorageResourcesDB).toService(TypeORMUserStorageResourcesDBImpl);

    bind(TypeORMAppInstallationDBImpl).toSelf().inSingletonScope();
    bind(AppInstallationDB).toService(TypeORMAppInstallationDBImpl);

    bind(TypeORMOneTimeSecretDBImpl).toSelf().inSingletonScope();
    bind(OneTimeSecretDB).toService(TypeORMOneTimeSecretDBImpl);
    bindDbWithTracing(TracedOneTimeSecretDB, bind, OneTimeSecretDB).inSingletonScope();

    bind(TypeORMPendingGithubEventDBImpl).toSelf().inSingletonScope();
    bind(PendingGithubEventDB).toService(TypeORMPendingGithubEventDBImpl);
    bind(TransactionalPendingGithubEventDBFactory).toFactory((ctx) => {
        return (manager: EntityManager) => {
            return new TransactionalPendingGithubEventDBImpl(manager);
        };
    });

    encryptionModule(bind, unbind, isBound, rebind);
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

    bind(CodeSyncResourceDB).toSelf().inSingletonScope();

    bind(WorkspaceClusterDB).to(WorkspaceClusterDBImpl).inSingletonScope();

    bind(AuthCodeRepositoryDB).toSelf().inSingletonScope();

    bind(TeamDBImpl).toSelf().inSingletonScope();
    bind(TeamDB).toService(TeamDBImpl);
    bind(ProjectDBImpl).toSelf().inSingletonScope();
    bind(ProjectDB).toService(ProjectDBImpl);
    bind(WebhookEventDBImpl).toSelf().inSingletonScope();
    bind(WebhookEventDB).toService(WebhookEventDBImpl);

    bind(PersonalAccessTokenDBImpl).toSelf().inSingletonScope();
    bind(PersonalAccessTokenDB).toService(PersonalAccessTokenDBImpl);

    // com concerns
    bind(AccountingDB).to(TypeORMAccountingDBImpl).inSingletonScope();
    bind(TransactionalAccountingDBFactory).toFactory((ctx) => {
        return (manager: EntityManager) => {
            return new TransactionalAccountingDBImpl(manager);
        };
    });
    bind(TeamSubscriptionDB).to(TeamSubscriptionDBImpl).inSingletonScope();
    bind(TeamSubscription2DB).to(TeamSubscription2DBImpl).inSingletonScope();
    bind(EmailDomainFilterDB).to(EmailDomainFilterDBImpl).inSingletonScope();
    bind(EduEmailDomainDB).to(EduEmailDomainDBImpl).inSingletonScope();
    bind(UserToTeamMigrationService).toSelf().inSingletonScope();
    bind(WorkspaceOrganizationIdMigration).toSelf().inSingletonScope();
    bind(Synchronizer).toSelf().inSingletonScope();
    bind(LinkedInProfileDBImpl).toSelf().inSingletonScope();
    bind(LinkedInProfileDB).toService(LinkedInProfileDBImpl);

    bind(LongRunningMigrationService).toSelf().inSingletonScope();
    bind(LongRunningMigration).to(WorkspaceOrganizationIdMigration).inSingletonScope();
});
