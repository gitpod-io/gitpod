/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Disposable, DisposableCollection, Emitter } from '@gitpod/gitpod-protocol';
import { filePathTelepresenceAware } from '@gitpod/gitpod-protocol/lib/env';
import { IDEClient, IDEOptions } from '@gitpod/gitpod-protocol/lib/ide-protocol';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { repeat } from '@gitpod/gitpod-protocol/lib/util/repeat';
import * as Ajv from 'ajv';
import * as cp from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { injectable } from 'inversify';
import debounce = require('lodash.debounce');

export interface IDEConfig {
    supervisorImage: string;
    ideOptions: IDEOptions;
    clients?: { [id: string]: IDEClient };
}

const scheme = {
    type: 'object',
    properties: {
        supervisorImage: {
            type: 'string',
        },
        ideOptions: {
            type: 'object',
            properties: {
                options: {
                    type: 'object',
                    additionalProperties: {
                        type: 'object',
                        properties: {
                            orderKey: { type: 'string' },
                            title: { type: 'string' },
                            type: { type: 'string' },
                            logo: { type: 'string' },
                            tooltip: { type: 'string' },
                            label: { type: 'string' },
                            nodes: { type: 'array', items: { type: 'string' } },
                            hidden: { type: 'boolean' },
                            image: { type: 'string' },
                            latestImage: { type: 'string' },
                            resolveImageDigest: { type: 'boolean' },
                        },
                        required: ['title', 'type', 'logo', 'image'],
                    },
                },
                defaultIde: { type: 'string' },
                defaultDesktopIde: { type: 'string' },
                clients: {
                    type: 'object',
                    additionalProperties: {
                        type: 'object',
                        properties: {
                            defaultDesktopIDE: { type: 'string' },
                            desktopIDEs: { type: 'array', items: { type: 'string' } },
                        },
                    },
                },
            },
            required: ['options', 'defaultIde', 'defaultDesktopIde'],
        },
    },
    required: ['supervisorImage', 'ideOptions'],
};

@injectable()
export class IDEConfigService {
    private readonly ajv = new Ajv();
    private readonly configPath: string;
    private readonly validate: Ajv.ValidateFunction;

    private state: {
        key?: string;
        value?: IDEConfig;
    } = {};
    private readonly onDidChangeEmitter = new Emitter<IDEConfig>();

    constructor() {
        const configPath = process.env.IDE_CONFIG_PATH;
        if (!configPath) {
            throw new Error('ide config: IDE_CONFIG_PATH not set');
        }
        this.configPath = filePathTelepresenceAware(configPath);
        this.validate = this.ajv.compile(scheme);
        this.reconcile('initial');
        fs.watchFile(this.configPath, (curr, prev) => {
            if (curr.mtimeMs != prev.mtimeMs) {
                this.reconcile('file changed');
            }
        });
        repeat(() => this.reconcile('interval'), 60 * 60 * 1000 /* 1 hour */);
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
    private reconcile = debounce(
        async (trigger: string) => {
            try {
                let fileContent: string | undefined;
                try {
                    fileContent = await fs.promises.readFile(this.configPath, { encoding: 'utf-8' });
                } catch {}
                if (!fileContent) {
                    return;
                }

                let value = this.state.value;

                const newValue: IDEConfig = JSON.parse(fileContent);
                const contentHash = crypto.createHash('sha256').update(fileContent, 'utf8').digest('hex');
                const contentChanged = this.contentHash !== contentHash;
                if (contentChanged) {
                    this.contentHash = contentHash;

                    this.validate(newValue);
                    if (this.validate.errors) {
                        throw new Error('invalid: ' + this.ajv.errorsText(this.validate.errors));
                    }

                    if (!(newValue.ideOptions.defaultIde in newValue.ideOptions.options)) {
                        throw new Error(
                            `invalid: There is no IDEOption entry for editor '${newValue.ideOptions.defaultIde}'.`,
                        );
                    }
                    if (!(newValue.ideOptions.defaultDesktopIde in newValue.ideOptions.options)) {
                        throw new Error(
                            `invalid: There is no IDEOption entry for default desktop IDE '${newValue.ideOptions.defaultDesktopIde}'.`,
                        );
                    }
                    if (newValue.ideOptions.options[newValue.ideOptions.defaultIde].type != 'browser') {
                        throw new Error(
                            `invalid: Editor '${
                                newValue.ideOptions.defaultIde
                            }' needs to be of type 'browser' but is '${
                                newValue.ideOptions.options[newValue.ideOptions.defaultIde].type
                            }'.`,
                        );
                    }
                    if (newValue.ideOptions.options[newValue.ideOptions.defaultDesktopIde].type != 'desktop') {
                        throw new Error(
                            `invalid: Editor (desktop), '${
                                newValue.ideOptions.defaultDesktopIde
                            }' needs to be of type 'desktop' but is '${
                                newValue.ideOptions.options[newValue.ideOptions.defaultIde].type
                            }'.`,
                        );
                    }

                    if (newValue.ideOptions.clients) {
                        for (const [clientId, client] of Object.entries(newValue.ideOptions.clients)) {
                            if (
                                client.defaultDesktopIDE &&
                                !(client.defaultDesktopIDE in newValue.ideOptions.options)
                            ) {
                                throw new Error(
                                    `${clientId} client: there is no option entry for editor '${client.defaultDesktopIDE}'.`,
                                );
                            }
                            if (client.desktopIDEs) {
                                for (const ide of client.desktopIDEs) {
                                    if (!(ide in newValue.ideOptions.options)) {
                                        throw new Error(
                                            `${clientId} client: there is no option entry for editor '${ide}'.`,
                                        );
                                    }
                                }
                            }
                        }
                    }

                    value = newValue;
                }

                if (!value) {
                    return;
                }

                // we only want to resolve image by interval or content changed
                if (!(contentChanged || trigger === 'interval')) {
                    return;
                }

                for (const [id, option] of Object.entries(newValue.ideOptions.options).filter(
                    ([_, x]) => !!x.resolveImageDigest,
                )) {
                    try {
                        value.ideOptions.options[id].image = await this.resolveImageDigest(option.image);
                        log.info('ide config: successfully resolved image digest', {
                            ide: id,
                            image: option.image,
                            resolvedImage: value.ideOptions.options[id].image,
                            trigger,
                        });
                    } catch (e) {
                        log.error('ide config: error while resolving image digest', e, { trigger });
                    }
                }

                for (const [id, option] of Object.entries(newValue.ideOptions.options).filter(
                    ([_, x]) => x.latestImage,
                )) {
                    try {
                        value.ideOptions.options[id].latestImage = await this.resolveImageDigest(option.latestImage!);
                        log.info('ide config: successfully resolved latest image digest', {
                            ide: id,
                            latestImage: option.latestImage,
                            resolvedImage: value.ideOptions.options[id].latestImage,
                            trigger,
                        });
                    } catch (e) {
                        log.error('ide config: error while resolving latest image digest', e, { trigger });
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
        },
        500,
        { leading: true },
    );

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
