/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */
export interface Connection {
    type: string;
    [key: string]: string;
}

export interface ConnectionType {
    id: string;
    name: string;
    attributes: string[];
    envVars: { name: string; value: string }[];
    tasks: { name: string; command: string }[];
    imageLayers: string[];
}
