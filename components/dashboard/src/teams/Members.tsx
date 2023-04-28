/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamMemberRole } from "@gitpod/gitpod-protocol";
import { TeamRole } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_pb";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { trackEvent } from "../Analytics";
import DropDown from "../components/DropDown";
import Header from "../components/Header";
import { Item, ItemField, ItemFieldContextMenu, ItemsList } from "../components/ItemsList";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import Tooltip from "../components/Tooltip";
import { useCurrentOrg, useOrganizationsInvalidator } from "../data/organizations/orgs-query";
import searchIcon from "../icons/search.svg";
import copy from "../images/copy.svg";
import { teamsService } from "../service/public-api";
import { useCurrentUser } from "../user-context";
import { SpinnerLoader } from "../components/Loader";

export default function MembersPage() {
    const user = useCurrentUser();
    const org = useCurrentOrg();
    const invalidateOrgs = useOrganizationsInvalidator();

    const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
    const [searchText, setSearchText] = useState<string>("");
    const [roleFilter, setRoleFilter] = useState<TeamMemberRole | undefined>();

    const getInviteURL = (inviteId?: string) => {
        if (!inviteId) return "no-invite-id";
        const link = new URL(window.location.href);
        link.pathname = "/orgs/join";
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
        await teamsService.resetTeamInvitation({ teamId: org.data?.id });
        invalidateOrgs();
    };

    const setTeamMemberRole = async (userId: string, role: TeamMemberRole) => {
        await teamsService.updateTeamMember({
            teamId: org.data?.id,
            teamMember: { userId, role: role === "owner" ? TeamRole.OWNER : TeamRole.MEMBER },
        });
        invalidateOrgs();
    };

    const removeTeamMember = async (userId: string) => {
        await teamsService.deleteTeamMember({ teamId: org.data?.id, teamMemberId: userId });
        invalidateOrgs();
    };

    const isRemainingOwner = useMemo(() => {
        const owners = org.data?.members.filter((m) => m.role === "owner");
        return owners?.length === 1 && owners[0].userId === user?.id;
    }, [org.data?.members, user?.id]);

    const filteredMembers =
        org.data?.members.filter((m) => {
            if (!!roleFilter && m.role !== roleFilter) {
                return false;
            }
            const memberSearchText = `${m.fullName || ""}${m.primaryEmail || ""}`.toLocaleLowerCase();
            if (!memberSearchText.includes(searchText.toLocaleLowerCase())) {
                return false;
            }
            return true;
        }) || [];

    return (
        <>
            <Header title="Members" subtitle="Manage organization members." />
            <div className="app-container">
                <div className="flex mb-3 mt-3">
                    <div className="flex relative h-10 my-auto">
                        <img
                            src={searchIcon}
                            title="Search"
                            className="filter-grayscale absolute top-3 left-3"
                            alt="search icon"
                        />
                        <input
                            className="w-64 pl-9 border-0"
                            type="search"
                            placeholder="Filter Members"
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </div>
                    <div className="flex-1" />
                    <div className="py-2 pl-3">
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
                                invite_url: getInviteURL(org.data?.invitationId),
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
                                    fillRule="evenodd"
                                    d="M13.366 8.234a.8.8 0 010 1.132l-4.8 4.8a.8.8 0 01-1.132 0l-4.8-4.8a.8.8 0 111.132-1.132L7.2 11.67V2.4a.8.8 0 111.6 0v9.269l3.434-3.435a.8.8 0 011.132 0z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </ItemField>
                        <ItemField className="flex items-center my-auto">
                            <span className="flex-grow">Role</span>
                        </ItemField>
                    </Item>
                    {filteredMembers.length === 0 ? (
                        <SpinnerLoader />
                    ) : (
                        filteredMembers.map((m) => (
                            <Item className="grid grid-cols-3" key={m.userId}>
                                <ItemField className="flex items-center my-auto">
                                    <div className="flex-shrink-0">
                                        {m.avatarUrl && (
                                            <img
                                                className="rounded-full w-8 h-8"
                                                src={m.avatarUrl || ""}
                                                alt={m.fullName}
                                            />
                                        )}
                                    </div>
                                    <div className="ml-5 truncate">
                                        <div
                                            className="text-base text-gray-900 dark:text-gray-50 font-medium"
                                            title={m.fullName}
                                        >
                                            {m.fullName}
                                        </div>
                                        <p title={m.primaryEmail}>{m.primaryEmail}</p>
                                    </div>
                                </ItemField>
                                <ItemField className="my-auto">
                                    <Tooltip content={dayjs(m.memberSince).format("MMM D, YYYY")}>
                                        <span className="text-gray-400">{dayjs(m.memberSince).fromNow()}</span>
                                    </Tooltip>
                                </ItemField>
                                <ItemField className="flex items-center my-auto">
                                    <span className="text-gray-400 capitalize">
                                        {org.data?.isOwner ? (
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
                                        ) : (
                                            m.role
                                        )}
                                    </span>
                                    <span className="flex-grow" />
                                    <ItemFieldContextMenu
                                        menuEntries={
                                            m.userId === user?.id
                                                ? [
                                                      {
                                                          title: !isRemainingOwner
                                                              ? "Leave Organization"
                                                              : "Remaining owner",
                                                          customFontStyle: !isRemainingOwner
                                                              ? "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                                                              : "text-gray-400 dark:text-gray-200",
                                                          onClick: () =>
                                                              !isRemainingOwner && removeTeamMember(m.userId),
                                                      },
                                                  ]
                                                : org.data?.isOwner
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
            {org.data?.invitationId && showInviteModal && (
                // TODO: Use title and buttons props
                <Modal visible={true} onClose={() => setShowInviteModal(false)}>
                    <ModalHeader>Invite Members</ModalHeader>
                    <ModalBody>
                        <label htmlFor="inviteUrl" className="font-medium">
                            Invite URL
                        </label>
                        <div className="w-full relative">
                            <input
                                name="inviteUrl"
                                disabled={true}
                                readOnly={true}
                                type="text"
                                value={getInviteURL(org.data?.invitationId)}
                                className="rounded-md w-full truncate overflow-x-scroll pr-8"
                            />
                            <div
                                className="cursor-pointer"
                                onClick={() => copyToClipboard(getInviteURL(org.data?.invitationId))}
                            >
                                <div className="absolute top-1/3 right-3">
                                    <Tooltip content={copied ? "Copied!" : "Copy Invite URL"}>
                                        <img src={copy} title="Copy Invite URL" alt="copy icon" />
                                    </Tooltip>
                                </div>
                            </div>
                        </div>
                        <p className="mt-1 text-gray-500 text-sm">
                            Use this URL to join this organization as a member.
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <button className="secondary" onClick={() => resetInviteLink()}>
                            Reset Invite Link
                        </button>
                        <button className="secondary" onClick={() => setShowInviteModal(false)}>
                            Close
                        </button>
                    </ModalFooter>
                </Modal>
            )}
        </>
    );
}
