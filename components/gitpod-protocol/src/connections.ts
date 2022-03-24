/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export type Connections = TailscaleConnection;

export interface Connection {
    id: string;
    imageLayer?: string;
}

export interface TailscaleConnection extends Connection {
    authKey: string;
}

export interface GCloudAdcConnection extends Connection {
    serviceAccount: string;
}
