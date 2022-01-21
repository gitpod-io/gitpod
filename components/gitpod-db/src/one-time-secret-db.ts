/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export const OneTimeSecretDB = Symbol('OneTimeSecretDB');

export interface OneTimeSecretDB {
  /**
   * Register registers a secret for one-time retrieval until a certain time.
   *
   * @param secret value to provide once
   * @param expirationTime until which the secret is available
   * @returns the key using which the secret can be retrieved
   */
  register(secret: string, expirationTime: Date): Promise<string>;

  /**
   * Get retrieves a secret and deletes it.
   * A secret can be retrieved only once.
   *
   * @param key by which to retrieve the secret
   * @returns the secret if available
   */
  get(key: string): Promise<string | undefined>;

  /**
   * Remove deletes a previously registered one-time-secret.
   *
   * @param key of the secret to remove
   */
  remove(key: string): Promise<void>;

  /**
   * Prune delets all expired one-time secretes.
   */
  pruneExpired(): Promise<void>;
}
