/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ContainerModule } from 'inversify';
import { ICommand, RunCommand, ExportCommand } from './commands';
import { TableDescriptionProvider, GitpodTableDescriptionProvider, GitpodSessionTableDescriptionProvider } from '@gitpod/gitpod-db/lib/tables';
import { PeriodicReplicatorProvider, PeriodicReplicator } from './replication';
import { TableUpdateProvider } from './export';
import { NamedConnection } from './database';

export const productionContainerModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(ICommand).to(RunCommand).inSingletonScope();
    bind(ICommand).to(ExportCommand).inSingletonScope();

    bind(TableDescriptionProvider).to(GitpodTableDescriptionProvider).inSingletonScope();
    bind(TableDescriptionProvider).to(GitpodSessionTableDescriptionProvider).inSingletonScope();
    bind(TableUpdateProvider).toSelf().inSingletonScope();

    bind(PeriodicReplicator).to(PeriodicReplicator).inRequestScope();
    bind(PeriodicReplicatorProvider).toProvider<PeriodicReplicator>(ctx =>
        async (source: NamedConnection, targets: NamedConnection[], syncInterval: number, tableSet: string | undefined) => {
            const r = ctx.container.get(PeriodicReplicator);
            r.setup(source, targets, syncInterval, tableSet);
            return r;
        }
    );
});
