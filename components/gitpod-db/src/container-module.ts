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
import { PendingGithubEventDB } from './pending-github-event-db';
import { TypeORMPendingGithubEventDBImpl } from './typeorm/pending-github-event-db-impl';
import { GitpodTableDescriptionProvider, TableDescriptionProvider } from './tables';
import { PeriodicDbDeleter } from './periodic-deleter';
import { TermsAcceptanceDB } from './terms-acceptance-db';
import { TermsAcceptanceDBImpl } from './typeorm/terms-acceptance-db-impl';
import { CodeSyncResourceDB } from './typeorm/code-sync-resource-db';

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
});
