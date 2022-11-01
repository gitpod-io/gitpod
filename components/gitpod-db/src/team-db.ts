/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Team, TeamMemberInfo, TeamMemberRole, TeamMembershipInvite } from "@gitpod/gitpod-protocol";
import { DBTeamMembership } from "./typeorm/entity/db-team-membership";

export const TeamDB = Symbol("TeamDB");
export interface TeamDB {
    findTeams(
        offset: number,
        limit: number,
        orderBy: keyof Team,
        orderDir: "ASC" | "DESC",
        searchTerm: string,
    ): Promise<{ total: number; rows: Team[] }>;
    findTeamById(teamId: string): Promise<Team | undefined>;
    findTeamByMembershipId(membershipId: string): Promise<Team | undefined>;
    findMembersByTeam(teamId: string): Promise<TeamMemberInfo[]>;
    findTeamMembership(userId: string, teamId: string): Promise<DBTeamMembership | undefined>;
    findTeamsByUser(userId: string): Promise<Team[]>;
    findTeamsByUserAsSoleOwner(userId: string): Promise<Team[]>;
    createTeam(userId: string, name: string): Promise<Team>;
    addMemberToTeam(userId: string, teamId: string): Promise<"added" | "already_member">;
    setTeamMemberRole(userId: string, teamId: string, role: TeamMemberRole): Promise<void>;
    setTeamMemberSubscription(userId: string, teamId: string, subscriptionId: string): Promise<void>;
    removeMemberFromTeam(userId: string, teamId: string): Promise<void>;
    findTeamMembershipInviteById(inviteId: string): Promise<TeamMembershipInvite>;
    findGenericInviteByTeamId(teamId: string): Promise<TeamMembershipInvite | undefined>;
    resetGenericInvite(teamId: string): Promise<TeamMembershipInvite>;
    deleteTeam(teamId: string): Promise<void>;
}
