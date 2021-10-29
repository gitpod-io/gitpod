/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as fs from 'fs';
import * as Ajv from 'ajv';
import * as cp from 'child_process';
import * as crypto from 'crypto';
import debounce = require('lodash.debounce')
import { injectable } from 'inversify';
import { Disposable, DisposableCollection, Emitter } from '@gitpod/gitpod-protocol';
import { filePathTelepresenceAware } from '@gitpod/gitpod-protocol/lib/env';

interface RawIDEConfig {
    ideVersion: string;
    ideImageRepo: string;
    ideImageAliases?: { [index: string]: string };
    desktopIdeImageAliases?: { [index: string]: string };
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
        },
        "desktopIdeImageAliases": {
            "type": "object",
            "additionalProperties": { "type": "string" }
        },
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
    desktopIdeImageAliases: { [index: string]: string };
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
        setInterval(() => this.reconcile(), 60 * 60 * 1000 /* 1 hour */);
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
            let fileContent: string | undefined;
            try {
                fileContent = await fs.promises.readFile(this.configPath, { encoding: "utf-8" });
            } catch { }
            if (!fileContent) {
                return;
            }

            let value = this.state.value;

            const raw: RawIDEConfig = JSON.parse(fileContent);
            const contentHash = crypto.createHash('sha256').update(fileContent, 'utf8').digest('hex');
            if (this.contentHash !== contentHash) {
                this.contentHash = contentHash;

                this.validate(raw);
                if (this.validate.errors) {
                    throw new Error('invalid: ' + this.ajv.errorsText(this.validate.errors));
                }
                const ideImage = `${raw.ideImageRepo}:${raw.ideVersion}`;
                value = {
                    ...raw,
                    ideImage: ideImage,
                    ideImageAliases: {
                        ...raw.ideImageAliases,
                        "theia": ideImage,
                    },
                    desktopIdeImageAliases: {
                        ...raw.desktopIdeImageAliases
                    }
                }
            }

            if (!value) {
                return;
            }

            try {
                if (raw.ideImageAliases?.['code-latest']){
                    value.ideImageAliases['code-latest'] = await this.resolveImageDigest(raw.ideImageAliases?.['code-latest']);
                }
            } catch (e) {
                console.error('ide config: error while resolving image digest: ', e);
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

    private resolveImageDigest(imageName:string) {
        return new Promise<string>((resolve, reject) => {
            cp.exec(`oci-tool --timeout 30s resolve name ${imageName}`, (error, imageDigest) => {
                if (error) {
                    return reject(error);
                }

                if (!imageDigest) {
                    throw new Error(`Cannot resolve ${imageName} image`);
                }

                return resolve(imageDigest.trim());
            });
        });
    }
}