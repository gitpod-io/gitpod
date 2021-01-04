/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';
import { UserStorageContribution } from '@theia/userstorage/lib/browser/user-storage-contribution';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileSystemProvider } from '@theia/filesystem/lib/common/files';
import { GitpodUserStorageProvider } from './gitpod-user-storage-provider';

@injectable()
export class GitpodUserStorageContribution extends UserStorageContribution {

    @inject(GitpodUserStorageProvider)
    protected readonly provider: GitpodUserStorageProvider;

    protected async createProvider(service: FileService): Promise<FileSystemProvider> {
        return this.provider;
    }

}