/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AppInstallation, AppInstallationPlatform, AppInstallationState } from '@gitpod/gitpod-protocol';
import { injectable, inject } from 'inversify';
import { TypeORM } from './typeorm';

import { AppInstallationDB } from '../app-installation-db';
import { Repository } from 'typeorm';
import { DBAppInstallation } from './entity/db-app-installation';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

@injectable()
export class TypeORMAppInstallationDBImpl implements AppInstallationDB {
  @inject(TypeORM) typeORM: TypeORM;

  protected async getEntityManager() {
    return (await this.typeORM.getConnection()).manager;
  }

  protected async getRepo(): Promise<Repository<DBAppInstallation>> {
    return (await this.getEntityManager()).getRepository(DBAppInstallation);
  }

  public async recordNewInstallation(
    platform: AppInstallationPlatform,
    source: 'user' | 'platform',
    installationID: string,
    ownerUserID?: string,
    platformUserID?: string,
  ): Promise<void> {
    const repo = await this.getRepo();

    const obj = new DBAppInstallation();
    obj.platform = platform;
    obj.installationID = installationID;
    obj.state = `claimed.${source}` as AppInstallationState;
    obj.ownerUserID = ownerUserID;
    obj.platformUserID = platformUserID;
    obj.creationTime = new Date().toISOString();
    await repo.insert(obj);
  }

  protected async findAndFinishInstallation(
    platform: AppInstallationPlatform,
    installationID: string,
  ): Promise<AppInstallation | undefined> {
    // check if we find the complementary installation entries. If so, finish the installation
    const repo = await this.getRepo();
    const installationRecords = await repo.find({ where: { platform, installationID } });

    // maybe we're already done and have a finished installation
    const finishedInstallation = installationRecords.find((r) => r.state == 'installed');
    if (!!finishedInstallation) {
      return finishedInstallation;
    }

    // maybe we need to finish an existing/ongoing installation
    const platformClaim = installationRecords.find((r) => r.state == 'claimed.platform');
    const userClaim = installationRecords.find((r) => r.state == 'claimed.user');
    if (!!platformClaim && !!userClaim) {
      const obj = new DBAppInstallation();
      obj.platform = platform;
      obj.installationID = installationID;
      obj.state = 'installed';
      obj.ownerUserID = userClaim.ownerUserID || platformClaim.ownerUserID || undefined;
      obj.platformUserID = platformClaim.platformUserID;
      obj.creationTime = new Date().toISOString();
      return await repo.save(obj);
    }

    // we do not have a finished installation here
    return undefined;
  }

  public async findInstallation(
    platform: AppInstallationPlatform,
    installationID: string,
  ): Promise<AppInstallation | undefined> {
    return this.findAndFinishInstallation(platform, installationID);
  }

  public async recordUninstallation(
    platform: AppInstallationPlatform,
    source: 'user' | 'platform',
    installationID: string,
  ) {
    const installation = await this.findInstallation(platform, installationID);
    if (!installation) {
      log.warn('Cannot record uninstallation of non-existent installation', { platform, installationID });
      return;
    }

    installation.state = 'uninstalled';

    const repo = await this.getRepo();
    await repo.save(installation);
  }
}
