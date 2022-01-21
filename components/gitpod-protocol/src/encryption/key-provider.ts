/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';

export interface KeyMetadata {
  name: string;
  version: number;
}

export interface Key {
  metadata: KeyMetadata;
  material: Buffer;
}

export const KeyProvider = Symbol('KeyProvider');
export interface KeyProvider {
  getPrimaryKey(): Key;
  getKeyFor(metadata: KeyMetadata): Key;
}

export type KeyConfig = KeyMetadata & {
  /** base64 encoded */
  material: string;
  primary?: boolean;
};

export const KeyProviderConfig = Symbol('KeyProviderConfig');
export interface KeyProviderConfig {
  keys: KeyConfig[];
}

@injectable()
export class KeyProviderImpl implements KeyProvider {
  static loadKeyConfigFromJsonString(configStr: string): KeyConfig[] {
    const keys = (JSON.parse(configStr) || []) as KeyConfig[];
    if (!Array.isArray(keys) || keys.length < 0 || 1 !== keys.reduce((p, k) => (k.primary ? p + 1 : p), 0)) {
      throw new Error('Invalid key config!');
    }
    return keys;
  }

  constructor(@inject(KeyProviderConfig) protected readonly config: KeyProviderConfig) {}

  protected get keys() {
    return this.config.keys;
  }

  getPrimaryKey(): Key {
    const primaryKey = this.keys.find((key) => !!key.primary);
    if (!primaryKey) {
      throw new Error('No primary encryption key found!');
    }
    return this.configToKey(primaryKey);
  }

  getKeyFor(metadata: KeyMetadata): Key {
    const key = this.keys.find((k) => k.name === metadata.name && k.version === metadata.version);
    if (!key) {
      throw new Error(`No key found for metadata ${metadata.name}/${metadata.version}`);
    }
    return this.configToKey(key);
  }

  protected configToKey(config: KeyConfig): Key {
    return {
      metadata: {
        name: config.name,
        version: config.version,
      },
      material: new Buffer(config.material, 'base64'),
    };
  }
}
