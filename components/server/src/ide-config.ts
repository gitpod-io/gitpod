/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Disposable, DisposableCollection, Emitter } from '@gitpod/gitpod-protocol';
import { filePathTelepresenceAware } from '@gitpod/gitpod-protocol/lib/env';
import { IDEOptions } from '@gitpod/gitpod-protocol/lib/ide-protocol';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import * as Ajv from 'ajv';
import * as cp from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { injectable } from 'inversify';
import debounce = require('lodash.debounce')

export interface IDEConfig {
    supervisorImage: string;
    ideOptions: IDEOptions;
}

const scheme = {
    "type": "object",
    "properties": {
        "supervisorImage": {
            "type": "string",
        },
        "ideOptions": {
            "type": "object",
            "properties": {
                "options": {
                    "type": "object",
                    "additionalProperties": {
                        "type": "object",
                        "properties": {
                            "orderKey": { "type": "string" },
                            "title": { "type": "string" },
                            "type": { "type": "string" },
                            "logo": { "type": "string" },
                            "tooltip": { "type": "string" },
                            "label": { "type": "string" },
                            "nodes": { "type": "array", "items": { "type": "string" } },
                            "hidden": { "type": "boolean" },
                            "image": { "type": "string" },
                            "resolveImageDigest": { "type": "boolean" },
                        },
                        "required": [
                            "title",
                            "type",
                            "logo",
                            "image",
                        ],
                    }
                },
                "defaultIde": { "type": "string" },
                "defaultDesktopIde": { "type": "string" },
            },
            "required": [
                "options",
                "defaultIde",
                "defaultDesktopIde",
            ],
        },
    },
    "required": [
        "supervisorImage",
        "ideOptions",
    ],
};

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
        this.reconcile("initial");
        fs.watchFile(this.configPath, () => this.reconcile("file changed"));
        setInterval(() => this.reconcile("interval"), 60 * 60 * 1000 /* 1 hour */);
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
    private reconcile = debounce(async (trigger: string) => {
        try {
            let fileContent: string | undefined;
            try {
                fileContent = await fs.promises.readFile(this.configPath, { encoding: "utf-8" });
            } catch { }
            if (!fileContent) {
                return;
            }

            let value = this.state.value;

            const newValue: IDEConfig = JSON.parse(fileContent);
            const contentHash = crypto.createHash('sha256').update(fileContent, 'utf8').digest('hex');
            if (this.contentHash !== contentHash) {
                this.contentHash = contentHash;

                this.validate(newValue);
                if (this.validate.errors) {
                    throw new Error('invalid: ' + this.ajv.errorsText(this.validate.errors));
                }

                if (!(newValue.ideOptions.defaultIde in newValue.ideOptions.options)) {
                    throw new Error(`invalid: There is no IDEOption entry for default IDE '${newValue.ideOptions.defaultIde}'.`);
                }
                if (!(newValue.ideOptions.defaultDesktopIde in newValue.ideOptions.options)) {
                    throw new Error(`invalid: There is no IDEOption entry for default desktop IDE '${newValue.ideOptions.defaultDesktopIde}'.`);
                }
                if (newValue.ideOptions.options[newValue.ideOptions.defaultIde].type != "browser") {
                    throw new Error(`invalid: Default IDE '${newValue.ideOptions.defaultIde}' needs to be of type 'browser' but is '${newValue.ideOptions.options[newValue.ideOptions.defaultIde].type}'.`);
                }
                if (newValue.ideOptions.options[newValue.ideOptions.defaultDesktopIde].type != "desktop") {
                    throw new Error(`invalid: Default desktop IDE '${newValue.ideOptions.defaultDesktopIde}' needs to be of type 'desktop' but is '${newValue.ideOptions.options[newValue.ideOptions.defaultIde].type}'.`);
                }

                value = newValue;
            }

            if (!value) {
                return;
            }

            for (const [id, option] of Object.entries(newValue.ideOptions.options).filter(([_, x]) => !!x.resolveImageDigest)) {
                try {
                    value.ideOptions.options[id].image = await this.resolveImageDigest(option.image);
                    log.info("ide config: successfully resolved image digest", {
                        ide: id,
                        image: option.image,
                        resolvedImage: value.ideOptions.options[id].image,
                        trigger,
                    });
                } catch (e) {
                    log.error('ide config: error while resolving image digest', e, { trigger });
                }
            }

            const key = JSON.stringify(value);
            if (key === this.state.key) {
                return;
            }

            log.info('ide config: updated', { newConfig: JSON.stringify(value, undefined, 2), trigger });
            this.state = { key, value };
            this.onDidChangeEmitter.fire(value);
        } catch (e) {
            log.error('ide config: failed to reconcile', e, { trigger });
        }
    }, 500, { leading: true });

    private resolveImageDigest(imageName: string) {
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
