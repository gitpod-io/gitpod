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
    // user.id is mapped to ConfigCat's "identifier" + "custom.user_id"
    user?: User | { id: string; email?: string };

    // Currently selected Gitpod Project ID (mapped to "custom.project_id")
    projectId?: string;

    // Currently selected Gitpod Team ID (mapped to "custom.team_id")
    teamId?: string;
    // Currently selected Gitpod Team Name (mapped to "custom.team_name")
    teamName?: string;

    // All the Gitpod Teams that the user is a member (or owner) of (mapped to "custom.team_names" and "custom.team_ids")
    teams?: Team[];
}

export interface Client {
    getValueAsync<T>(experimentName: string, defaultValue: T, attributes: Attributes): Promise<T>;

    // dispose will dispose of the client, no longer retrieving flags
    dispose(): void;
}
