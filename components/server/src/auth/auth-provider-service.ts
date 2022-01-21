/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';
import { AuthProviderEntry as AuthProviderEntry, User } from '@gitpod/gitpod-protocol';
import { AuthProviderParams } from './auth-provider';
import { AuthProviderEntryDB } from '@gitpod/gitpod-db/lib';
import { Config } from '../config';
import { v4 as uuidv4 } from 'uuid';
import { oauthUrls as githubUrls } from '../github/github-urls';
import { oauthUrls as gitlabUrls } from '../gitlab/gitlab-urls';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

@injectable()
export class AuthProviderService {
  @inject(AuthProviderEntryDB)
  protected authProviderDB: AuthProviderEntryDB;

  @inject(Config)
  protected readonly config: Config;

  /**
   * Returns all auth providers.
   */
  async getAllAuthProviders(): Promise<AuthProviderParams[]> {
    const all = await this.authProviderDB.findAll();
    const transformed = all.map(this.toAuthProviderParams.bind(this));

    // as a precaution, let's remove duplicates
    const unique = transformed.reduce((prev, current) => {
      const duplicate = prev.some((a) => a.host === current.host);
      if (duplicate) {
        log.warn(`Duplicate dynamic Auth Provider detected.`, { rawResult: all, duplicate: current.host });
      }
      return duplicate ? prev : [...prev, current];
    }, [] as AuthProviderParams[]);
    return unique;
  }

  protected toAuthProviderParams = (oap: AuthProviderEntry) =>
    <AuthProviderParams>{
      ...oap,
      host: oap.host.toLowerCase(),
      verified: oap.status === 'verified',
      builtin: false,
      // hiddenOnDashboard: true, // i.e. show only if it's used
      loginContextMatcher: `https://${oap.host}/`,
      oauth: {
        ...oap.oauth,
        clientId: oap.oauth.clientId || 'no',
        clientSecret: oap.oauth.clientSecret || 'no',
      },
    };

  async getAuthProvidersOfUser(user: User | string): Promise<AuthProviderEntry[]> {
    const result = await this.authProviderDB.findByUserId(User.is(user) ? user.id : user);
    return result;
  }

  async deleteAuthProvider(authProvider: AuthProviderEntry): Promise<void> {
    await this.authProviderDB.delete(authProvider);
  }

  async updateAuthProvider(
    entry: AuthProviderEntry.UpdateEntry | AuthProviderEntry.NewEntry,
  ): Promise<AuthProviderEntry> {
    let authProvider: AuthProviderEntry;
    if ('id' in entry) {
      const { id, ownerId } = entry;
      const existing = (await this.authProviderDB.findByUserId(ownerId)).find((p) => p.id === id);
      if (!existing) {
        throw new Error('Provider does not exist.');
      }
      const changed =
        entry.clientId !== existing.oauth.clientId ||
        (entry.clientSecret && entry.clientSecret !== existing.oauth.clientSecret);

      if (!changed) {
        return existing;
      }

      // update config on demand
      authProvider = {
        ...existing,
        oauth: {
          ...existing.oauth,
          clientId: entry.clientId,
          clientSecret: entry.clientSecret || existing.oauth.clientSecret, // FE may send empty ("") if not changed
        },
        status: 'pending',
      };
    } else {
      const existing = await this.authProviderDB.findByHost(entry.host);
      if (existing) {
        throw new Error('Provider for this host already exists.');
      }
      authProvider = this.initializeNewProvider(entry);
    }
    return await this.authProviderDB.storeAuthProvider(authProvider as AuthProviderEntry);
  }
  protected initializeNewProvider(newEntry: AuthProviderEntry.NewEntry): AuthProviderEntry {
    const { host, type, clientId, clientSecret } = newEntry;
    const urls = type === 'GitHub' ? githubUrls(host) : type === 'GitLab' ? gitlabUrls(host) : undefined;
    if (!urls) {
      throw new Error('Unexpected service type.');
    }
    return <AuthProviderEntry>{
      ...newEntry,
      id: uuidv4(),
      type,
      oauth: {
        ...urls,
        callBackUrl: this.callbackUrl(host),
        clientId,
        clientSecret,
      },
      status: 'pending',
    };
  }

  async markAsVerified(params: { ownerId: string; id: string }) {
    const { ownerId, id } = params;
    let ap: AuthProviderEntry | undefined;
    try {
      let authProviders = await this.authProviderDB.findByUserId(ownerId);
      if (authProviders.length === 0) {
        // "no-user" is the magic user id assigned during the initial setup
        authProviders = await this.authProviderDB.findByUserId('no-user');
      }
      ap = authProviders.find((p) => p.id === id);
      if (ap) {
        ap = {
          ...ap,
          ownerId: ownerId,
          status: 'verified',
        };
        await this.authProviderDB.storeAuthProvider(ap);
      } else {
        log.warn('Failed to find the AuthProviderEntry to be activated.', { params, id, ap });
      }
    } catch (error) {
      log.error('Failed to activate AuthProviderEntry.', { params, id, ap });
    }
  }

  protected callbackUrl = (host: string) => {
    const pathname = `/auth/${host}/callback`;
    if (this.config.devBranch) {
      // for example: https://staging.gitpod-dev.com/auth/mydomain.com/gitlab/callback
      return this.config.hostUrl.withoutDomainPrefix(1).with({ pathname }).toString();
    }
    return this.config.hostUrl.with({ pathname }).toString();
  };
}
