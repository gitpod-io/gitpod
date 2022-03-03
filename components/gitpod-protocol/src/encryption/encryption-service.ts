/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';

import { EncryptedData, EncryptionEngine } from './encryption-engine';
import { KeyProvider, KeyMetadata } from './key-provider';

export interface Encrypted<_T> extends EncryptedData {
    keyMetadata: KeyMetadata;
}

export const EncryptionService = Symbol('EncryptionService');
export interface EncryptionService {
    encrypt<T>(data: T): Encrypted<T>;
    decrypt<T>(encrypted: Encrypted<T>): T;
}

@injectable()
export class EncryptionServiceImpl implements EncryptionService {
    @inject(EncryptionEngine) protected readonly engine: EncryptionEngine;
    @inject(KeyProvider) protected readonly keyProvider: KeyProvider;

    encrypt<T>(data: T): Encrypted<T> {
        const dataStr = this.serialize(data);
        const key = this.keyProvider.getPrimaryKey();

        const encryptedData = this.engine.encrypt(dataStr, key.material);
        return {
            ...encryptedData,
            keyMetadata: key.metadata,
        };
    }

    decrypt<T>(encrypted: Encrypted<T>): T {
        const key = this.keyProvider.getKeyFor(encrypted.keyMetadata);
        const serializedData = this.engine.decrypt(encrypted, key.material);
        return this.deserialize(serializedData);
    }

    protected serialize(data: any): string {
        return JSON.stringify(data);
    }

    protected deserialize<T>(data: string): T {
        return JSON.parse(data) as T;
    }
}
