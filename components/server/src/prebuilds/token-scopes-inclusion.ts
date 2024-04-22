/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// Check inclusion of existing scopes in the required scopes
export const containsScopes = (existingScopes: string[] | undefined, requiredScopes: string[]) => {
    return requiredScopes.every((requiredScope) => existingScopes?.includes(requiredScope));
};
