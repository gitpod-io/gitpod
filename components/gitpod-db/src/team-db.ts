/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Team, TeamMemberInfo, TeamMemberRole, TeamMembershipInvite } from "@gitpod/gitpod-protocol";

export const TeamDB = Symbol('TeamDB');
export interface TeamDB {
    findTeamById(teamId: string): Promise<Team | undefined>;
    findMembersByTeam(teamId: string): Promise<TeamMemberInfo[]>;
    findTeamsByUser(userId: string): Promise<Team[]>;
    createTeam(userId: string, name: string): Promise<Team>;
    addMemberToTeam(userId: string, teamId: string): Promise<void>;
    setTeamMemberRole(userId: string, teamId: string, role: TeamMemberRole): Promise<void>;
    removeMemberFromTeam(userId: string, teamId: string): Promise<void>;
    findTeamMembershipInviteById(inviteId: string): Promise<TeamMembershipInvite>;
    findGenericInviteByTeamId(teamId: string): Promise<TeamMembershipInvite | undefined>;
    resetGenericInvite(teamId: string): Promise<TeamMembershipInvite>;
    deleteTeam(teamId: string): Promise<void>;
}
