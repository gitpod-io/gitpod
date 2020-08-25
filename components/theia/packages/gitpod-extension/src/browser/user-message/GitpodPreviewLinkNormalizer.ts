/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PreviewLinkNormalizer } from "@theia/preview/lib/browser/preview-link-normalizer";
import URI from "@theia/core/lib/common/uri";


export class GitpodPreviewLinkNormalizer extends PreviewLinkNormalizer {

    normalizeLink(documentUri: URI, link: string): string {
        try {
            if (documentUri.scheme === 'file') {
                return super.normalizeLink(documentUri, link);
            }
            return documentUri.parent.resolve(link).toString();
        } catch {
            // ignore
        }
        return link;
    }
}