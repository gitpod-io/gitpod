/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as fs from 'fs';
import * as Ajv from 'ajv';
import * as crypto from 'crypto';
import debounce = require('lodash.debounce')
import { injectable } from 'inversify';
import { Disposable, DisposableCollection, Emitter } from '@gitpod/gitpod-protocol';
import { filePathTelepresenceAware } from '@gitpod/gitpod-protocol/lib/env';

interface RawIDEConfig {
    ideVersion: string;
    ideImageRepo: string;
    ideImageAliases?: { [index: string]: string };
}
const scheme = {
    "type": "object",
    "properties": {
        "ideVersion": {
            "type": "string"
        },
        "ideImageRepo": {
            "type": "string"
        },
        "ideImageAliases": {
            "type": "object",
            "additionalProperties": { "type": "string" }
        }
    },
    "required": [
        "ideVersion",
        "ideImageRepo"
    ]
};

export interface IDEConfig {
    ideVersion: string;
    ideImageRepo: string;
    ideImageAliases: { [index: string]: string };

    ideImage: string;
}

@injectable()
export class IDEConfigService {

    private readonly ajv = new Ajv();
    private readonly configPath: string;
    private readonly validate: Ajv.ValidateFunction;

    private state: {
        key?: string,
        value?: IDEConfig
    } = {};
    private readonly onDidChangeEmitter = new Emitter<IDEConfig>();

    constructor() {
        const configPath = process.env.IDE_CONFIG_PATH
        if (!configPath) {
            throw new Error('ide config: IDE_CONFIG_PATH not set');
        }
        this.configPath = filePathTelepresenceAware(configPath);
        this.validate = this.ajv.compile(scheme);
        this.reconcile();
        fs.watchFile(this.configPath, () => this.reconcile());
    }

    get config(): Promise<IDEConfig> {
        if (this.state.value) {
            return Promise.resolve(this.state.value);
        }
        const toFinalize = new DisposableCollection();
        return new Promise<IDEConfig>((resolve, reject) => {
            const timeoutHandle = setTimeout(() => reject(new Error('ide config: read timeout')), 30 * 1000);
            toFinalize.push(Disposable.create(() => clearTimeout(timeoutHandle)));
            toFinalize.push(this.onDidChangeEmitter.event(resolve));
        }).finally(() => toFinalize.dispose());
    }

    private contentHash: string | undefined;
    private reconcile = debounce(async () => {
        try {
            let content: string | undefined;
            try {
                content = await fs.promises.readFile(this.configPath, { encoding: "utf-8" });
            } catch { }
            if (!content) {
                return;
            }
            const contentHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
            if (this.contentHash === contentHash) {
                return;
            }
            this.contentHash = contentHash;

            const raw: RawIDEConfig = JSON.parse(content);
            this.validate(raw);
            if (this.validate.errors) {
                throw new Error('invalid: ' + this.ajv.errorsText(this.validate.errors));
            }
            const ideImage = `${raw.ideImageRepo}:${raw.ideVersion}`;
            const value: IDEConfig = {
                ...raw,
                ideImage: ideImage,
                ideImageAliases: {
                    ...raw.ideImageAliases,
                    "theia": ideImage,
                }
            }
            const key = JSON.stringify(value);
            if (key === this.state.key) {
                return;
            }
            console.log('ide config updated: ' + JSON.stringify(value, undefined, 2));
            this.state = { key, value };
            this.onDidChangeEmitter.fire(value);
        } catch (e) {
            console.error('ide config: failed to reconcile: ', e);
        }
    }, 500, { leading: true });

}