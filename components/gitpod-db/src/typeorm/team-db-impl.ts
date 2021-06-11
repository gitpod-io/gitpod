/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Team, TeamMemberInfo, User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { TypeORM } from "./typeorm";
import { Repository } from "typeorm";
import * as uuidv4 from 'uuid/v4';
import { TeamDB } from "../team-db";
import { DBTeam } from "./entity/db-team";
import { DBTeamMembership } from "./entity/db-team-membership";
import { DBUser } from "./entity/db-user";

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

    protected async getUserRepo(): Promise<Repository<DBUser>> {
        return (await this.getEntityManager()).getRepository<DBUser>(DBUser);
    }

    public async findTeamById(teamId: string): Promise<Team | undefined> {
        const teamRepo = await this.getTeamRepo();
        return teamRepo.findOne({ id: teamId });
    }

    public async findMembersByTeam(teamId: string): Promise<TeamMemberInfo[]> {
        const membershipRepo = await this.getMembershipRepo();
        const userRepo = await this.getUserRepo();
        const memberships = await membershipRepo.find({ teamId });
        const users = await userRepo.findByIds(memberships.map(m => m.userId));
        return users.map(u => ({
            userId: u.id,
            fullName: u.fullName || u.name,
            primaryEmail: User.getPrimaryEmail(u),
            avatarUrl: u.avatarUrl,
            role: memberships.find(m => m.userId === u.id)!.role,
            memberSince: u.creationDate,
        }));
    }

    public async findTeamsByUser(userId: string): Promise<Team[]> {
        const teamRepo = await this.getTeamRepo();
        const membershipRepo = await this.getMembershipRepo();
        const memberships = await membershipRepo.find({ userId });
        return teamRepo.findByIds(memberships.map(m => m.teamId));
    }

    public async createTeam(userId: string, name: string): Promise<Team> {
        if (!name) {
            throw new Error('Team name cannot be empty');
        }
        if (!/^[A-Za-z0-9 _-]+$/.test(name)) {
            throw new Error('Please choose a team name containing only letters, numbers, -, _, or spaces.');
        }
        const slug = name.toLocaleLowerCase().replace(/ /g, '-');
        const teamRepo = await this.getTeamRepo();
        const existingTeam = await teamRepo.findOne({ slug });
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

    public async addMemberToTeam(userId: string, teamId: string): Promise<void> {
        if (teamId.length !== 36) {
            throw new Error('This team ID is incorrect');
        }
        const teamRepo = await this.getTeamRepo();
        const team = await teamRepo.findOneById(teamId);
        if (!team) {
            throw new Error('A team with this ID could not be found');
        }
        const membershipRepo = await this.getMembershipRepo();
        const membership = await membershipRepo.findOne({ teamId, userId });
        if (!!membership) {
            throw new Error('You are already a member of this team');
        }
        await membershipRepo.save({
            id: uuidv4(),
            teamId: team.id,
            userId,
            role: 'member',
            creationTime: new Date().toISOString(),
        });
    }
}
