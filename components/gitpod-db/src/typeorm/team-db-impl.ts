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
import { v4 as uuidv4 } from "uuid";
import { TeamDB } from "../team-db";
import { DBTeam } from "./entity/db-team";
import { DBTeamMembership } from "./entity/db-team-membership";
import { DBUser } from "./entity/db-user";
import { DBTeamMembershipInvite } from "./entity/db-team-membership-invite";
import { ResponseError } from "vscode-jsonrpc";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

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

    public async findTeams(
        offset: number,
        limit: number,
        orderBy: keyof Team,
        orderDir: "DESC" | "ASC",
        searchTerm?: string,
    ): Promise<{ total: number; rows: Team[] }> {
        const teamRepo = await this.getTeamRepo();
        const queryBuilder = teamRepo
            .createQueryBuilder("team")
            .where("team.name LIKE :searchTerm", { searchTerm: `%${searchTerm}%` })
            .skip(offset)
            .take(limit)
            .orderBy(orderBy, orderDir);

        const [rows, total] = await queryBuilder.getManyAndCount();
        return { total, rows };
    }

    public async findTeamById(teamId: string): Promise<Team | undefined> {
        const teamRepo = await this.getTeamRepo();
        return teamRepo.findOne({ id: teamId, deleted: false, markedDeleted: false });
    }

    public async findTeamByMembershipId(membershipId: string): Promise<Team | undefined> {
        const membershipRepo = await this.getMembershipRepo();
        const membership = await membershipRepo.findOne({ id: membershipId, deleted: false });
        if (!membership) {
            return;
        }
        return this.findTeamById(membership.teamId);
    }

    public async findMembersByTeam(teamId: string): Promise<TeamMemberInfo[]> {
        const membershipRepo = await this.getMembershipRepo();
        const userRepo = await this.getUserRepo();
        const memberships = await membershipRepo.find({ teamId, deleted: false });
        const users = await userRepo.findByIds(memberships.map((m) => m.userId));
        const infos = users.map((u) => {
            const m = memberships.find((m) => m.userId === u.id)!;
            return {
                userId: u.id,
                fullName: u.fullName || u.name,
                primaryEmail: User.getPrimaryEmail(u),
                avatarUrl: u.avatarUrl,
                role: m.role,
                memberSince: m.creationTime,
            };
        });
        return infos.sort((a, b) => (a.memberSince < b.memberSince ? 1 : a.memberSince === b.memberSince ? 0 : -1));
    }

    public async findTeamMembership(userId: string, teamId: string): Promise<DBTeamMembership | undefined> {
        const membershipRepo = await this.getMembershipRepo();
        return membershipRepo.findOne({ userId, teamId, deleted: false });
    }

    public async findTeamsByUser(userId: string): Promise<Team[]> {
        const teamRepo = await this.getTeamRepo();
        const membershipRepo = await this.getMembershipRepo();
        const memberships = await membershipRepo.find({ userId, deleted: false });
        const teams = await teamRepo.findByIds(memberships.map((m) => m.teamId));
        return teams.filter((t) => !t.markedDeleted);
    }

    public async findTeamsByUserAsSoleOwner(userId: string): Promise<Team[]> {
        // Find the memberships of this user,
        // and among the memberships, get the teams where the user is the sole owner
        const soleOwnedTeams = [];
        const userTeams = await this.findTeamsByUser(userId);
        for (const team of userTeams) {
            const memberships = await this.findMembersByTeam(team.id);
            const ownerships = memberships.filter((m) => m.role === "owner");
            if (ownerships.length === 1 && ownerships[0].userId === userId) {
                soleOwnedTeams.push(team);
            }
        }
        return soleOwnedTeams;
    }

    public async createTeam(userId: string, name: string): Promise<Team> {
        if (!name) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "Team name cannot be empty");
        }
        if (!/^[A-Za-z0-9 '_-]+$/.test(name)) {
            throw new ResponseError(
                ErrorCodes.BAD_REQUEST,
                "Please choose a team name containing only letters, numbers, -, _, ', or spaces.",
            );
        }
        const slug = name.toLocaleLowerCase().replace(/[ ']/g, "-");
        if (blocklist.indexOf(slug) !== -1) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "Creating a team with this name is not allowed");
        }
        const userRepo = await this.getUserRepo();
        const existingUsers = await userRepo.query(
            "SELECT COUNT(id) AS count FROM d_b_user WHERE fullName LIKE ? OR name LIKE ?",
            [name, slug],
        );
        if (Number.parseInt(existingUsers[0].count) > 0) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "A team cannot have the same name as an existing user");
        }
        const teamRepo = await this.getTeamRepo();
        const existingTeam = await teamRepo.findOne({ slug, deleted: false, markedDeleted: false });
        if (!!existingTeam) {
            throw new ResponseError(ErrorCodes.CONFLICT, "A team with this name already exists");
        }
        const team: Team = {
            id: uuidv4(),
            name,
            slug,
            creationTime: new Date().toISOString(),
        };
        await teamRepo.save(team);
        const membershipRepo = await this.getMembershipRepo();
        await membershipRepo.save({
            id: uuidv4(),
            teamId: team.id,
            userId,
            role: "owner",
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

    public async addMemberToTeam(userId: string, teamId: string): Promise<"added" | "already_member"> {
        const teamRepo = await this.getTeamRepo();
        const team = await teamRepo.findOne(teamId);
        if (!team || !!team.deleted) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "A team with this ID could not be found");
        }
        const membershipRepo = await this.getMembershipRepo();
        const membership = await membershipRepo.findOne({ teamId, userId, deleted: false });
        if (!!membership) {
            // already a member, this is the desired outcome
            return "already_member";
        }
        await membershipRepo.save({
            id: uuidv4(),
            teamId: team.id,
            userId,
            role: "member",
            creationTime: new Date().toISOString(),
        });
        return "added";
    }

    public async setTeamMemberRole(userId: string, teamId: string, role: TeamMemberRole): Promise<void> {
        const teamRepo = await this.getTeamRepo();
        const team = await teamRepo.findOne(teamId);
        if (!team || !!team.deleted) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "A team with this ID could not be found");
        }
        const membershipRepo = await this.getMembershipRepo();

        if (role != "owner") {
            const ownerCount = await membershipRepo.count({
                teamId,
                role: "owner",
                deleted: false,
            });
            if (ownerCount <= 1) {
                throw new ResponseError(ErrorCodes.CONFLICT, "Team must retain at least one owner");
            }
        }

        const membership = await membershipRepo.findOne({ teamId, userId, deleted: false });
        if (!membership) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "The user is not currently a member of this team");
        }
        membership.role = role;
        await membershipRepo.save(membership);
    }

    public async setTeamMemberSubscription(userId: string, teamId: string, subscriptionId: string): Promise<void> {
        const teamRepo = await this.getTeamRepo();
        const team = await teamRepo.findOne(teamId);
        if (!team || !!team.deleted) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "A team with this ID could not be found");
        }
        const membershipRepo = await this.getMembershipRepo();
        const membership = await membershipRepo.findOne({ teamId, userId, deleted: false });
        if (!membership) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "The user is not currently a member of this team");
        }
        membership.subscriptionId = subscriptionId;
        await membershipRepo.save(membership);
    }

    public async removeMemberFromTeam(userId: string, teamId: string): Promise<void> {
        const teamRepo = await this.getTeamRepo();
        const team = await teamRepo.findOne(teamId);
        if (!team || !!team.deleted) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "A team with this ID could not be found");
        }
        const membershipRepo = await this.getMembershipRepo();
        const membership = await membershipRepo.findOne({ teamId, userId, deleted: false });
        if (!membership) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "You are not currently a member of this team");
        }
        membership.deleted = true;
        await membershipRepo.save(membership);
    }

    public async findTeamMembershipInviteById(inviteId: string): Promise<TeamMembershipInvite> {
        const inviteRepo = await this.getMembershipInviteRepo();
        const invite = await inviteRepo.findOne(inviteId);
        if (!invite) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "No invite found for the given ID.");
        }
        return invite;
    }

    public async findGenericInviteByTeamId(teamId: string): Promise<TeamMembershipInvite | undefined> {
        const inviteRepo = await this.getMembershipInviteRepo();
        const all = await inviteRepo.find({ teamId });
        return all.filter((i) => i.invalidationTime === "" && !i.invitedEmail)[0];
    }

    public async resetGenericInvite(teamId: string): Promise<TeamMembershipInvite> {
        const inviteRepo = await this.getMembershipInviteRepo();
        const invite = await this.findGenericInviteByTeamId(teamId);
        if (invite && invite.invalidationTime === "") {
            invite.invalidationTime = new Date().toISOString();
            await inviteRepo.save(invite);
        }

        const newInvite: TeamMembershipInvite = {
            id: uuidv4(),
            creationTime: new Date().toISOString(),
            invalidationTime: "",
            role: "member",
            teamId,
        };
        await inviteRepo.save(newInvite);
        return newInvite;
    }
}
