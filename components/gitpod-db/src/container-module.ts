/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ContainerModule } from 'inversify';

import { WorkspaceDB } from './workspace-db';
import { TypeORMWorkspaceDBImpl, TransactionalWorkspaceDbImpl } from './typeorm/workspace-db-impl';
import { TypeORMUserDBImpl } from './typeorm/user-db-impl';
import { UserDB } from './user-db';
import { Config } from './config';
import { UserMessageViewsDB } from './user-message-views-db';
import { TypeORMUserMessageViewsDBImpl } from './typeorm/user-message-views-db-impl';
import { UserStorageResourcesDB } from './user-storage-resources-db';
import { TypeORMUserStorageResourcesDBImpl } from './typeorm/user-storage-resources-db-impl';
import { TypeORM } from './typeorm/typeorm';
import { encryptionModule } from '@gitpod/gitpod-protocol/lib/encryption/container-module';
import { KeyProviderImpl, KeyProviderConfig } from '@gitpod/gitpod-protocol/lib/encryption/key-provider';
import { DBWithTracing, bindDbWithTracing, TracedWorkspaceDB, TracedUserDB, TracedOneTimeSecretDB } from './traced-db';
import { OneTimeSecretDB } from './one-time-secret-db';
import { DeletedEntryGC } from './typeorm/deleted-entry-gc';
import { TypeORMAppInstallationDBImpl } from './typeorm/app-installation-db-impl';
import { AppInstallationDB } from './app-installation-db';
import { TheiaPluginDBImpl } from './typeorm/theia-plugin-db-impl';
import { TheiaPluginDB } from './theia-plugin-db';
import { TypeORMOneTimeSecretDBImpl } from './typeorm/one-time-secret-db-impl';
import { PendingGithubEventDB, TransactionalPendingGithubEventDBFactory } from './pending-github-event-db';
import { TransactionalPendingGithubEventDBImpl, TypeORMPendingGithubEventDBImpl } from './typeorm/pending-github-event-db-impl';
import { GitpodTableDescriptionProvider, TableDescriptionProvider } from './tables';
import { PeriodicDbDeleter } from './periodic-deleter';
import { TermsAcceptanceDB } from './terms-acceptance-db';
import { TermsAcceptanceDBImpl } from './typeorm/terms-acceptance-db-impl';
import { CodeSyncResourceDB } from './typeorm/code-sync-resource-db';
import { WorkspaceClusterDBImpl } from './typeorm/workspace-cluster-db-impl';
import { WorkspaceClusterDB } from './workspace-cluster-db';
import { AuthCodeRepositoryDB } from './typeorm/auth-code-repository-db';
import { AuthProviderEntryDB } from './auth-provider-entry-db';
import { AuthProviderEntryDBImpl } from './typeorm/auth-provider-entry-db-impl';
import { TeamSubscriptionDB } from './team-subscription-db';
import { AccountingDB, TransactionalAccountingDBFactory } from './accounting-db';
import { EmailDomainFilterDB } from './email-domain-filter-db';
import { EduEmailDomainDB } from './edu-email-domain-db';
import { EMailDB } from './email-db';
import { LicenseDB } from './license-db';
import { LicenseDBImpl } from './typeorm/license-db-impl';
import { TypeORMEMailDBImpl } from './typeorm/email-db-impl';
import { EduEmailDomainDBImpl } from './typeorm/edu-email-domain-db-impl';
import { EmailDomainFilterDBImpl } from './typeorm/email-domain-filter-db-impl';
import { TeamSubscriptionDBImpl } from './typeorm/team-subscription-db-impl';
import { TransactionalAccountingDBImpl, TypeORMAccountingDBImpl } from './typeorm/accounting-db-impl';
import { TeamDB } from './team-db';
import { TeamDBImpl } from './typeorm/team-db-impl';
import { ProjectDB } from './project-db';
import { ProjectDBImpl } from './typeorm/project-db-impl';
import { EntityManager } from 'typeorm';
import { OssAllowListDB } from './oss-allowlist-db';
import { OssAllowListDBImpl } from './typeorm/oss-allowlist-db-impl';
import { TypeORMInstallationAdminImpl } from './typeorm/installation-admin-db-impl';
import { InstallationAdminDB } from './installation-admin-db';

// THE DB container module that contains all DB implementations
export const dbContainerModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(Config).toSelf().inSingletonScope();
    bind(TypeORM).toSelf().inSingletonScope();
    bind(DBWithTracing).toSelf().inSingletonScope();
    bind(TransactionalWorkspaceDbImpl).toSelf().inSingletonScope();
    bind(DeletedEntryGC).toSelf().inSingletonScope();

    bind(TypeORMUserDBImpl).toSelf().inSingletonScope();
    bind(UserDB).toService(TypeORMUserDBImpl);
    bind(TermsAcceptanceDBImpl).toSelf().inSingletonScope();
    bind(TermsAcceptanceDB).toService(TermsAcceptanceDBImpl);
    bindDbWithTracing(TracedUserDB, bind, UserDB).inSingletonScope();

    bind(TypeORMInstallationAdminImpl).toSelf().inSingletonScope();
    bind(InstallationAdminDB).toService(TypeORMInstallationAdminImpl);

    bind(AuthProviderEntryDB).to(AuthProviderEntryDBImpl).inSingletonScope();

    bind(TypeORMWorkspaceDBImpl).toSelf().inSingletonScope();
    bind(WorkspaceDB).toService(TypeORMWorkspaceDBImpl);
    bindDbWithTracing(TracedWorkspaceDB, bind, WorkspaceDB).inSingletonScope();

    bind(TypeORMUserMessageViewsDBImpl).toSelf().inSingletonScope();
    bind(UserMessageViewsDB).toService(TypeORMUserMessageViewsDBImpl);

    bind(TypeORMUserStorageResourcesDBImpl).toSelf().inSingletonScope();
    bind(UserStorageResourcesDB).toService(TypeORMUserStorageResourcesDBImpl);

    bind(TypeORMAppInstallationDBImpl).toSelf().inSingletonScope();
    bind(AppInstallationDB).toService(TypeORMAppInstallationDBImpl);

    bind(TheiaPluginDBImpl).toSelf().inSingletonScope();
    bind(TheiaPluginDB).toService(TheiaPluginDBImpl);

    bind(TypeORMOneTimeSecretDBImpl).toSelf().inSingletonScope();
    bind(OneTimeSecretDB).toService(TypeORMOneTimeSecretDBImpl);
    bindDbWithTracing(TracedOneTimeSecretDB, bind, OneTimeSecretDB).inSingletonScope();

    bind(TypeORMPendingGithubEventDBImpl).toSelf().inSingletonScope();
    bind(PendingGithubEventDB).toService(TypeORMPendingGithubEventDBImpl);
    bind(TransactionalPendingGithubEventDBFactory).toFactory(ctx => {
        return (manager: EntityManager) => {
            return new TransactionalPendingGithubEventDBImpl(manager);
        }
    });

    encryptionModule(bind, unbind, isBound, rebind);
    bind(KeyProviderConfig).toDynamicValue(ctx => {
        const config = ctx.container.get<Config>(Config);
        return {
            keys: KeyProviderImpl.loadKeyConfigFromJsonString(config.dbEncryptionKeys)
        };
    }).inSingletonScope();

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

    // com concerns
    bind(AccountingDB).to(TypeORMAccountingDBImpl).inSingletonScope();
    bind(TransactionalAccountingDBFactory).toFactory(ctx => {
        return (manager: EntityManager) => {
            return new TransactionalAccountingDBImpl(manager);
        }
    });
    bind(TeamSubscriptionDB).to(TeamSubscriptionDBImpl).inSingletonScope();
    bind(EmailDomainFilterDB).to(EmailDomainFilterDBImpl).inSingletonScope();
    bind(EduEmailDomainDB).to(EduEmailDomainDBImpl).inSingletonScope();
    bind(EMailDB).to(TypeORMEMailDBImpl).inSingletonScope();
    bind(LicenseDB).to(LicenseDBImpl).inSingletonScope();
    bind(OssAllowListDB).to(OssAllowListDBImpl).inSingletonScope();
});
