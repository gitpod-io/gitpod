/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { TeamMemberInfo, TeamMemberRole } from "@gitpod/gitpod-protocol";
import dayjs from "dayjs";
import { useContext, useEffect, useState } from "react";
import { useHistory, useLocation } from "react-router";
import Header from "../components/Header";
import DropDown from "../components/DropDown";
import { ItemsList, Item, ItemField, ItemFieldContextMenu } from "../components/ItemsList";
import Modal from "../components/Modal";
import Tooltip from "../components/Tooltip";
import copy from "../images/copy.svg";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import { TeamsContext, getCurrentTeam } from "./teams-context";
import { trackEvent } from "../Analytics";
import { FeatureFlagContext } from "../contexts/FeatureFlagContext";
import { publicApiTeamMembersToProtocol, publicApiTeamsToProtocol, teamsService } from "../service/public-api";
import { TeamRole } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_pb";

export default function () {
    const { user } = useContext(UserContext);
    const { teams, setTeams } = useContext(TeamsContext);
    const { usePublicApiTeamsService } = useContext(FeatureFlagContext);

    const history = useHistory();
    const location = useLocation();
    const team = getCurrentTeam(location, teams);
    const [members, setMembers] = useState<TeamMemberInfo[]>([]);
    const [genericInviteId, setGenericInviteId] = useState<string>();
    const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
    const [searchText, setSearchText] = useState<string>("");
    const [roleFilter, setRoleFilter] = useState<TeamMemberRole | undefined>();
    const [leaveTeamEnabled, setLeaveTeamEnabled] = useState<boolean>(false);

    useEffect(() => {
        if (!team) {
            return;
        }
        (async () => {
            let members: TeamMemberInfo[];
            let invite: string;

            if (usePublicApiTeamsService) {
                const response = await teamsService.getTeam({ teamId: team.id });
                members = publicApiTeamMembersToProtocol(response.team?.members || []);
                invite = response.team?.teamInvitation?.id || "";
            } else {
                const [teamMembers, genericInvite] = await Promise.all([
                    getGitpodService().server.getTeamMembers(team.id),
                    getGitpodService().server.getGenericInvite(team.id),
                ]);
                members = teamMembers;
                invite = genericInvite.id;
            }

            setMembers(members);
            setGenericInviteId(invite);
        })();
    }, [team]);

    useEffect(() => {
        const owners = members.filter((m) => m.role === "owner");
        const isOwner = owners.some((o) => o.userId === user?.id);
        setLeaveTeamEnabled(!isOwner || owners.length > 1);
    }, [members]);

    const ownMemberInfo = members.find((m) => m.userId === user?.id);

    const getInviteURL = (inviteId: string) => {
        const link = new URL(window.location.href);
        link.pathname = "/teams/join";
        link.search = "?inviteId=" + inviteId;
        return link.href;
    };

    const [copied, setCopied] = useState<boolean>(false);
    const copyToClipboard = (text: string) => {
        const el = document.createElement("textarea");
        el.value = text;
        document.body.appendChild(el);
        el.select();
        try {
            document.execCommand("copy");
        } finally {
            document.body.removeChild(el);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const resetInviteLink = async () => {
        // reset genericInvite first to prevent races on double click
        if (genericInviteId) {
            setGenericInviteId(undefined);
            const newInviteId = usePublicApiTeamsService
                ? (await teamsService.resetTeamInvitation({ teamId: team!.id })).teamInvitation?.id
                : (await getGitpodService().server.resetGenericInvite(team!.id)).id;
            setGenericInviteId(newInviteId);
        }
    };

    const setTeamMemberRole = async (userId: string, role: TeamMemberRole) => {
        usePublicApiTeamsService
            ? await teamsService.updateTeamMember({
                  teamId: team!.id,
                  teamMember: { userId, role: role === "owner" ? TeamRole.OWNER : TeamRole.MEMBER },
              })
            : await getGitpodService().server.setTeamMemberRole(team!.id, userId, role);

        const members = usePublicApiTeamsService
            ? publicApiTeamMembersToProtocol((await teamsService.getTeam({ teamId: team!.id })).team?.members || [])
            : await getGitpodService().server.getTeamMembers(team!.id);

        setMembers(members);
    };

    const removeTeamMember = async (userId: string) => {
        usePublicApiTeamsService
            ? await teamsService.deleteTeamMember({ teamId: team!.id, teamMemberId: userId })
            : await getGitpodService().server.removeTeamMember(team!.id, userId);

        const newTeams = usePublicApiTeamsService
            ? publicApiTeamsToProtocol((await teamsService.listTeams({})).teams)
            : await getGitpodService().server.getTeams();

        if (newTeams.some((t) => t.id === team!.id)) {
            // We're still a member of this team.

            const newMembers = usePublicApiTeamsService
                ? publicApiTeamMembersToProtocol((await teamsService.getTeam({ teamId: team!.id })).team?.members || [])
                : await getGitpodService().server.getTeamMembers(team!.id);
            setMembers(newMembers);
        } else {
            // We're no longer a member of this team (note: we navigate away first in order to avoid a 404).
            history.push("/");
            setTeams(newTeams);
        }
    };

    const filteredMembers = members.filter((m) => {
        if (!!roleFilter && m.role !== roleFilter) {
            return false;
        }
        const memberSearchText = `${m.fullName || ""}${m.primaryEmail || ""}`.toLocaleLowerCase();
        if (!memberSearchText.includes(searchText.toLocaleLowerCase())) {
            return false;
        }
        return true;
    });

    return (
        <>
            <Header title="Members" subtitle="Manage team members." />
            <div className="app-container">
                <div className="flex mt-8">
                    <div className="flex">
                        <div className="py-4">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 16 16"
                                width="16"
                                height="16"
                            >
                                <path
                                    fill="#A8A29E"
                                    d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z"
                                />
                            </svg>
                        </div>
                        <input
                            type="search"
                            placeholder="Search Members"
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </div>
                    <div className="flex-1" />
                    <div className="py-3 pl-3">
                        <DropDown
                            prefix="Role: "
                            customClasses="w-32"
                            activeEntry={roleFilter === "owner" ? "Owner" : roleFilter === "member" ? "Member" : "All"}
                            entries={[
                                {
                                    title: "All",
                                    onClick: () => setRoleFilter(undefined),
                                },
                                {
                                    title: "Owner",
                                    onClick: () => setRoleFilter("owner"),
                                },
                                {
                                    title: "Member",
                                    onClick: () => setRoleFilter("member"),
                                },
                            ]}
                        />
                    </div>
                    <button
                        onClick={() => {
                            trackEvent("invite_url_requested", {
                                invite_url: getInviteURL(genericInviteId!),
                            });
                            setShowInviteModal(true);
                        }}
                        className="ml-2"
                    >
                        Invite Members
                    </button>
                </div>
                <ItemsList className="mt-2">
                    <Item header={true} className="grid grid-cols-3">
                        <ItemField className="my-auto">
                            <span className="pl-14">Name</span>
                        </ItemField>
                        <ItemField className="flex items-center space-x-1 my-auto">
                            <span>Joined</span>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" className="h-4 w-4" viewBox="0 0 16 16">
                                <path
                                    fill="#A8A29E"
                                    fill-rule="evenodd"
                                    d="M13.366 8.234a.8.8 0 010 1.132l-4.8 4.8a.8.8 0 01-1.132 0l-4.8-4.8a.8.8 0 111.132-1.132L7.2 11.67V2.4a.8.8 0 111.6 0v9.269l3.434-3.435a.8.8 0 011.132 0z"
                                    clip-rule="evenodd"
                                />
                            </svg>
                        </ItemField>
                        <ItemField className="flex items-center my-auto">
                            <span className="flex-grow">Role</span>
                        </ItemField>
                    </Item>
                    {filteredMembers.length === 0 ? (
                        <p className="pt-16 text-center">No members found</p>
                    ) : (
                        filteredMembers.map((m) => (
                            <Item className="grid grid-cols-3" key={m.userId}>
                                <ItemField className="flex items-center my-auto">
                                    <div className="w-14">
                                        {m.avatarUrl && (
                                            <img
                                                className="rounded-full w-8 h-8"
                                                src={m.avatarUrl || ""}
                                                alt={m.fullName}
                                            />
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-base text-gray-900 dark:text-gray-50 font-medium">
                                            {m.fullName}
                                        </div>
                                        <p>{m.primaryEmail}</p>
                                    </div>
                                </ItemField>
                                <ItemField className="my-auto">
                                    <span className="text-gray-400">{dayjs(m.memberSince).fromNow()}</span>
                                </ItemField>
                                <ItemField className="flex items-center my-auto">
                                    <span className="text-gray-400 capitalize">
                                        {ownMemberInfo?.role !== "owner" ? (
                                            m.role
                                        ) : (
                                            <DropDown
                                                customClasses="w-32"
                                                activeEntry={m.role}
                                                entries={[
                                                    {
                                                        title: "owner",
                                                        onClick: () => setTeamMemberRole(m.userId, "owner"),
                                                    },
                                                    {
                                                        title: "member",
                                                        onClick: () => setTeamMemberRole(m.userId, "member"),
                                                    },
                                                ]}
                                            />
                                        )}
                                    </span>
                                    <span className="flex-grow" />
                                    <ItemFieldContextMenu
                                        menuEntries={
                                            m.userId === user?.id
                                                ? [
                                                      {
                                                          title: leaveTeamEnabled ? "Leave Team" : "Remaining owner",
                                                          customFontStyle: leaveTeamEnabled
                                                              ? "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                                                              : "text-gray-400 dark:text-gray-200",
                                                          onClick: () => leaveTeamEnabled && removeTeamMember(m.userId),
                                                      },
                                                  ]
                                                : ownMemberInfo?.role === "owner"
                                                ? [
                                                      {
                                                          title: "Remove",
                                                          customFontStyle:
                                                              "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
                                                          onClick: () => removeTeamMember(m.userId),
                                                      },
                                                  ]
                                                : []
                                        }
                                    />
                                </ItemField>
                            </Item>
                        ))
                    )}
                </ItemsList>
            </div>
            {genericInviteId && showInviteModal && (
                // TODO: Use title and buttons props
                <Modal visible={true} onClose={() => setShowInviteModal(false)}>
                    <h3 className="mb-4">Invite Members</h3>
                    <div className="border-t border-b border-gray-200 dark:border-gray-800 -mx-6 px-6 py-4 flex flex-col">
                        <label htmlFor="inviteUrl" className="font-medium">
                            Invite URL
                        </label>
                        <div className="w-full relative">
                            <input
                                name="inviteUrl"
                                disabled={true}
                                readOnly={true}
                                type="text"
                                value={getInviteURL(genericInviteId!)}
                                className="rounded-md w-full truncate overflow-x-scroll pr-8"
                            />
                            <div
                                className="cursor-pointer"
                                onClick={() => copyToClipboard(getInviteURL(genericInviteId!))}
                            >
                                <div className="absolute top-1/3 right-3">
                                    <Tooltip content={copied ? "Copied!" : "Copy Invite URL"}>
                                        <img src={copy} title="Copy Invite URL" />
                                    </Tooltip>
                                </div>
                            </div>
                        </div>
                        <p className="mt-1 text-gray-500 text-sm">Use this URL to join this team as a Member.</p>
                    </div>
                    <div className="flex justify-end mt-6 space-x-2">
                        <button className="secondary" onClick={() => resetInviteLink()}>
                            Reset Invite Link
                        </button>
                        <button className="secondary" onClick={() => setShowInviteModal(false)}>
                            Close
                        </button>
                    </div>
                </Modal>
            )}
        </>
    );
}
