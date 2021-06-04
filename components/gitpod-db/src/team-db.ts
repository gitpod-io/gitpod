/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Team } from "@gitpod/gitpod-protocol";
import { DBTeamMembership } from "./typeorm/entity/db-team-membership";

export const TeamDB = Symbol('TeamDB');
export interface TeamDB {
    findTeamById(teamId: string): Promise<Team | undefined>;
    findMembershipsByTeam(teamId: string): Promise<DBTeamMembership[]>;
    findTeamsByUser(userId: string): Promise<Team[]>;
    createTeam(userId: string, name: string): Promise<Team>;
}