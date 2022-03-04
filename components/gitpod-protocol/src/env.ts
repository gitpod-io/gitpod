/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";

const legacyStagenameTranslation: { [key: string]: KubeStage } = {
    "production": "production",
    "staging": "prodcopy",
    "devstaging": "dev",
    "dev": "dev"
}

export function translateLegacyStagename(kubeStage: string): KubeStage {
    const stage = legacyStagenameTranslation[kubeStage];
    if (!stage) {
        throw new Error(`Invalid KUBE_STAGE: ${kubeStage}`);
    }

    return stage;
}

@injectable()
export abstract class AbstractComponentEnv {
    readonly kubeStage: KubeStage = getEnvVarParsed('KUBE_STAGE', translateLegacyStagename);

    readonly installationLongname: string = getEnvVar("GITPOD_INSTALLATION_LONGNAME")
    readonly installationShortname: string = getEnvVar("GITPOD_INSTALLATION_SHORTNAME")
}

export type KubeStage = 'production' | 'prodcopy' | 'staging' | 'dev';

export function getEnvVar(name: string, defaultValue?: string): string {
    const value = process.env[name] || defaultValue;
    if (!value) {
        throw new Error(`Environment variable undefined or empty: ${name}`);
    }
    return value;
}

export function filePathTelepresenceAware(filePath: string): string {
    if (filePath && process.env.TELEPRESENCE_ROOT) {
        filePath = process.env.TELEPRESENCE_ROOT + filePath;
    }
    return filePath;
}

export function getEnvVarParsed<T>(name: string, parser: (value: string) => T, defaultValue?: string): T {
    return parser(getEnvVar(name, defaultValue));
}
