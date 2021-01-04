/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export const openVSXExtensionProviderPath = '/services/openVSXExtension';

export const OpenVSXExtensionProvider = Symbol('OpenVSXExtensionProvider');

export interface OpenVSXExtensionProvider {
    downloadExtension(id: string, version?: string): Promise<string>;
}
