/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export type DefaultWorkspaceImageValidator = (
    userId: string,
    imageRef: string,
    organizationId?: string,
) => Promise<void>;
export const DefaultWorkspaceImageValidator = Symbol("DefaultWorkspaceImageValidator");
