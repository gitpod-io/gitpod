/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from "../protocol";
import { Team } from "../teams-projects-protocol";

export const Client = Symbol("Client");

// Attributes define attributes which can be used to segment audiences.
// Set the attributes which you want to use to group audiences into.
export interface Attributes {
    user?: User | { id: string; email?: string };

    // Currently selected Gitpod Project ID
    projectId?: string;

    // Currently selected Gitpod Team ID
    teamId?: string;
    // Currently selected Gitpod Team Name
    teamName?: string;

    // All the Gitpod Teams that the user is a member (or owner) of
    teams?: Team[];
}

export interface Client {
    getValueAsync<T>(experimentName: string, defaultValue: T, attributes: Attributes): Promise<T>;

    // dispose will dispose of the client, no longer retrieving flags
    dispose(): void;
}
