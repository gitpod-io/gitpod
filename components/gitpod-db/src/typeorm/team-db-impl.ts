/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { list as blocklist } from "the-big-username-blacklist";
import { Team, TeamMemberInfo, TeamMemberRole, TeamMembershipInvite, User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { TypeORM } from "./typeorm";
import { Repository } from "typeorm";
import * as uuidv4 from 'uuid/v4';
import { TeamDB } from "../team-db";
import { DBTeam } from "./entity/db-team";
import { DBTeamMembership } from "./entity/db-team-membership";
import { DBUser } from "./entity/db-user";
import { DBTeamMembershipInvite } from "./entity/db-team-membership-invite";

const FORBIDDEN_SLUGS = [
    'access-control',
    'account',
    'admin',
    'blocked',
    'branches',
    'from-referrer',
    'install-github-app',
    'integrations',
    'issues',
    'login',
    'merge-requests',
    'new',
    'notifications',
    'oauth-approval',
    'plans',
    'prebuilds',
    'preferences',
    'projects',
    'pull-requests',
    'settings',
    'setup',
    'snapshots',
    'sorry',
    'start',
    'subscription',
    'teams',
    'upgrade-subscription',
    'usage',
    'variables',
    'workspaces',
    ...(blocklist),
].sort((a, b) => b > a ? -1 : 1);

@injectable()
export class TeamDBImpl implements TeamDB {
    @inject(TypeORM) typeORM: TypeORM;

    protected async getEntityManager() {
        return (await this.typeORM.getConnection()).manager;
    }

    protected async getTeamRepo(): Promise<Repository<DBTeam>> {
        return (await this.getEntityManager()).getRepository<DBTeam>(DBTeam);
    }

    protected async getMembershipRepo(): Promise<Repository<DBTeamMembership>> {
        return (await this.getEntityManager()).getRepository<DBTeamMembership>(DBTeamMembership);
    }

    protected async getMembershipInviteRepo(): Promise<Repository<DBTeamMembershipInvite>> {
        return (await this.getEntityManager()).getRepository<DBTeamMembershipInvite>(DBTeamMembershipInvite);
    }

    protected async getUserRepo(): Promise<Repository<DBUser>> {
        return (await this.getEntityManager()).getRepository<DBUser>(DBUser);
    }

    public async findTeamById(teamId: string): Promise<Team | undefined> {
        const teamRepo = await this.getTeamRepo();
        return teamRepo.findOne({ id: teamId, deleted: false });
    }

    public async findMembersByTeam(teamId: string): Promise<TeamMemberInfo[]> {
        const membershipRepo = await this.getMembershipRepo();
        const userRepo = await this.getUserRepo();
        const memberships = await membershipRepo.find({ teamId, deleted: false });
        const users = await userRepo.findByIds(memberships.map(m => m.userId));
        const infos = users.map(u => {
            const m = memberships.find(m => m.userId === u.id)!;
            return {
                userId: u.id,
                fullName: u.fullName || u.name,
                primaryEmail: User.getPrimaryEmail(u),
                avatarUrl: u.avatarUrl,
                role: m.role,
                memberSince: m.creationTime,
            };
        });
        return infos.sort((a,b) => a.memberSince < b.memberSince ? 1 : (a.memberSince === b.memberSince ? 0 : -1));
    }

    public async findTeamsByUser(userId: string): Promise<Team[]> {
        const teamRepo = await this.getTeamRepo();
        const membershipRepo = await this.getMembershipRepo();
        const memberships = await membershipRepo.find({ userId, deleted: false });
        const teams = await teamRepo.findByIds(memberships.map(m => m.teamId));
        return teams.filter(t => !t.deleted);
    }

    public async createTeam(userId: string, name: string): Promise<Team> {
        if (!name) {
            throw new Error('Team name cannot be empty');
        }
        if (!/^[A-Za-z0-9 '_-]+$/.test(name)) {
            throw new Error('Please choose a team name containing only letters, numbers, -, _, \', or spaces.');
        }
        const slug = name.toLocaleLowerCase().replace(/[ ']/g, '-');
        if (FORBIDDEN_SLUGS.indexOf(slug) !== -1) {
            throw new Error('Creating a team with this name is not allowed');
        }
        const userRepo = await this.getUserRepo();
        const existingUsers = await userRepo.query('SELECT COUNT(id) AS count FROM d_b_user WHERE fullName LIKE ? OR name LIKE ?', [ name, slug ]);
        if (existingUsers[0].count > 0) {
            throw new Error('A team cannot have the same name as an existing user');
        }
        const teamRepo = await this.getTeamRepo();
        const existingTeam = await teamRepo.findOne({ slug, deleted: false });
        if (!!existingTeam) {
            throw new Error('A team with this name already exists');
        }
        const team: Team = {
            id: uuidv4(),
            name,
            slug,
            creationTime: new Date().toISOString(),
        }
        await teamRepo.save(team);
        const membershipRepo = await this.getMembershipRepo();
        await membershipRepo.save({
            id: uuidv4(),
            teamId: team.id,
            userId,
            role: 'owner',
            creationTime: team.creationTime,
        });
        return team;
    }

    public async deleteTeam(teamId: string): Promise<void> {
        const teamRepo = await this.getTeamRepo();
        const team = await this.findTeamById(teamId);
        if (team) {
            team.markedDeleted = true;
            await teamRepo.save(team);
        }
    }

    public async addMemberToTeam(userId: string, teamId: string): Promise<void> {
        const teamRepo = await this.getTeamRepo();
        const team = await teamRepo.findOneById(teamId);
        if (!team || !!team.deleted) {
            throw new Error('A team with this ID could not be found');
        }
        const membershipRepo = await this.getMembershipRepo();
        const membership = await membershipRepo.findOne({ teamId, userId, deleted: false });
        if (!!membership) {
            throw new Error(`You are already a member of this team. (${team.slug})`);
        }
        await membershipRepo.save({
            id: uuidv4(),
            teamId: team.id,
            userId,
            role: 'member',
            creationTime: new Date().toISOString(),
        });
    }

    public async setTeamMemberRole(userId: string, teamId: string, role: TeamMemberRole): Promise<void> {
        const teamRepo = await this.getTeamRepo();
        const team = await teamRepo.findOneById(teamId);
        if (!team || !!team.deleted) {
            throw new Error('A team with this ID could not be found');
        }
        const membershipRepo = await this.getMembershipRepo();
        const membership = await membershipRepo.findOne({ teamId, userId, deleted: false });
        if (!membership) {
            throw new Error('The user is not currently a member of this team');
        }
        membership.role = role;
        await membershipRepo.save(membership);
    }

    public async removeMemberFromTeam(userId: string, teamId: string): Promise<void> {
        const teamRepo = await this.getTeamRepo();
        const team = await teamRepo.findOneById(teamId);
        if (!team || !!team.deleted) {
            throw new Error('A team with this ID could not be found');
        }
        const membershipRepo = await this.getMembershipRepo();
        const membership = await membershipRepo.findOne({ teamId, userId, deleted: false });
        if (!membership) {
            throw new Error('You are not currently a member of this team');
        }
        membership.deleted = true;
        await membershipRepo.save(membership);
    }

    public async findTeamMembershipInviteById(inviteId: string): Promise<TeamMembershipInvite> {
        const inviteRepo = await this.getMembershipInviteRepo();
        const invite = await inviteRepo.findOneById(inviteId);
        if (!invite) {
            throw new Error('No invite found for the given ID.');
        }
        return invite;
    }

    public async findGenericInviteByTeamId(teamId: string): Promise<TeamMembershipInvite| undefined> {
        const inviteRepo = await this.getMembershipInviteRepo();
        const all = await inviteRepo.find({ teamId });
        return all.filter(i => i.invalidationTime === '' && !i.invitedEmail)[0];
    }

    public async resetGenericInvite(teamId: string): Promise<TeamMembershipInvite> {
        const inviteRepo = await this.getMembershipInviteRepo();
        const invite = await this.findGenericInviteByTeamId(teamId);
        if (invite && invite.invalidationTime === '') {
            invite.invalidationTime = new Date().toISOString();
            await inviteRepo.save(invite);
        }

        const newInvite :TeamMembershipInvite = {
            id: uuidv4(),
            creationTime: new Date().toISOString(),
            invalidationTime: '',
            role: 'member',
            teamId
        }
        await inviteRepo.save(newInvite);
        return newInvite;
    }
}
