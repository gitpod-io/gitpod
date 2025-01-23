/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    Team,
    TeamMemberInfo,
    TeamMemberRole,
    TeamMembershipInvite,
    OrganizationSettings,
    OrgEnvVar,
    OrgEnvVarWithValue,
} from "@gitpod/gitpod-protocol";
import { DBTeamMembership } from "./typeorm/entity/db-team-membership";
import { TransactionalDB } from "./typeorm/transactional-db-impl";

export const TeamDB = Symbol("TeamDB");
export interface TeamDB extends TransactionalDB<TeamDB> {
    findTeams(
        offset: number,
        limit: number | undefined,
        orderBy: keyof Team,
        orderDir: "ASC" | "DESC",
        searchTerm?: string,
    ): Promise<{ total: number; rows: Team[] }>;
    findTeamById(teamId: string): Promise<Team | undefined>;
    findTeamByMembershipId(membershipId: string): Promise<Team | undefined>;
    findMembersByTeam(teamId: string): Promise<TeamMemberInfo[]>;
    findTeamMembership(userId: string, teamId: string): Promise<DBTeamMembership | undefined>;
    findTeamsByUser(userId: string): Promise<Team[]>;
    findTeamsByUserAsSoleOwner(userId: string): Promise<Team[]>;
    createTeam(userId: string, name: string): Promise<Team>;
    updateTeam(teamId: string, team: Pick<Team, "name">): Promise<Team>;
    addMemberToTeam(userId: string, teamId: string): Promise<"added" | "already_member">;
    setTeamMemberRole(userId: string, teamId: string, role: TeamMemberRole): Promise<void>;
    removeMemberFromTeam(userId: string, teamId: string): Promise<void>;
    findTeamMembershipInviteById(inviteId: string): Promise<TeamMembershipInvite>;
    findGenericInviteByTeamId(teamId: string): Promise<TeamMembershipInvite | undefined>;
    resetGenericInvite(teamId: string): Promise<TeamMembershipInvite>;
    deleteTeam(teamId: string): Promise<void>;

    findOrgSettings(teamId: string): Promise<OrganizationSettings | undefined>;
    setOrgSettings(teamId: string, settings: Partial<OrganizationSettings>): Promise<OrganizationSettings>;

    hasActiveSSO(organizationId: string): Promise<boolean>;

    addOrgEnvironmentVariable(orgId: string, envVar: OrgEnvVarWithValue): Promise<OrgEnvVar>;
    updateOrgEnvironmentVariable(orgId: string, envVar: Partial<OrgEnvVarWithValue>): Promise<OrgEnvVar | undefined>;
    getOrgEnvironmentVariableById(id: string): Promise<OrgEnvVar | undefined>;
    findOrgEnvironmentVariableByName(orgId: string, name: string): Promise<OrgEnvVar | undefined>;
    getOrgEnvironmentVariables(orgId: string): Promise<OrgEnvVar[]>;
    getOrgEnvironmentVariableValues(envVars: Pick<OrgEnvVar, "id" | "orgId">[]): Promise<OrgEnvVarWithValue[]>;
    deleteOrgEnvironmentVariable(id: string): Promise<void>;
}
