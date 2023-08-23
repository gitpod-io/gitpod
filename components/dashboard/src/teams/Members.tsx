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
import { teamsService } from "../service/public-api";
import { useCurrentUser } from "../user-context";
import { SpinnerLoader } from "../components/Loader";
import { Delayed } from "../components/Delayed";
import { InputField } from "../components/forms/InputField";
import { InputWithCopy } from "../components/InputWithCopy";

export default function MembersPage() {
    const user = useCurrentUser();
    const org = useCurrentOrg();
    const invalidateOrgs = useOrganizationsInvalidator();

    const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
    const [searchText, setSearchText] = useState<string>("");
    const [roleFilter, setRoleFilter] = useState<TeamMemberRole | undefined>();

    const inviteUrl = useMemo(() => {
        if (!org.data) {
            return undefined;
        }
        // orgs without an invitation id invite members through their own login page
        const link = new URL(window.location.href);
        if (!org.data.invitationId) {
            link.pathname = "/login/" + org.data.slug;
        } else {
            link.pathname = "/orgs/join";
            link.search = "?inviteId=" + org.data.invitationId;
        }
        return link.href;
    }, [org.data]);

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

    const isOwner = useMemo(() => {
        const owners = org.data?.members.filter((m) => m.role === "owner");
        return !!owners?.some((o) => o.userId === user?.id);
    }, [org.data?.members, user?.id]);

    // Note: We would hardly get here, but just in case. We should show a loader instead of blank section.
    if (org.isLoading) {
        return (
            <Delayed>
                <SpinnerLoader />
            </Delayed>
        );
    }

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
            <Header title="Members" subtitle="Manage organization members and their permissions." />
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
                    <div className="py-2 pl-3 pr-1 border border-gray-100 dark:border-gray-800 ml-2 rounded-md">
                        <DropDown
                            customClasses="w-32"
                            activeEntry={
                                roleFilter === "owner" ? "Owners" : roleFilter === "member" ? "Members" : "All"
                            }
                            entries={[
                                {
                                    title: "All",
                                    onClick: () => setRoleFilter(undefined),
                                },
                                {
                                    title: "Owners",
                                    onClick: () => setRoleFilter("owner"),
                                },
                                {
                                    title: "Members",
                                    onClick: () => setRoleFilter("member"),
                                },
                            ]}
                        />
                    </div>
                    <div className="flex-1" />
                    {isOwner && (
                        <button
                            onClick={() => {
                                trackEvent("invite_url_requested", {
                                    invite_url: inviteUrl || "",
                                });
                                setShowInviteModal(true);
                            }}
                            className="ml-2"
                        >
                            Invite Members
                        </button>
                    )}
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
                        <p className="pt-16 text-center">No members found</p>
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
            {inviteUrl && showInviteModal && (
                // TODO: Use title and buttons props
                <Modal visible={true} onClose={() => setShowInviteModal(false)}>
                    <ModalHeader>Invite Members</ModalHeader>
                    <ModalBody>
                        <InputField label="Invite URL" hint="Use this URL to join this organization as a member.">
                            <InputWithCopy value={inviteUrl} tip="Copy Invite URL" />
                        </InputField>
                    </ModalBody>
                    <ModalFooter>
                        {!!org?.data?.invitationId && (
                            <button className="secondary" onClick={() => resetInviteLink()}>
                                Reset Invite Link
                            </button>
                        )}
                        <button className="secondary" onClick={() => setShowInviteModal(false)}>
                            Close
                        </button>
                    </ModalFooter>
                </Modal>
            )}
        </>
    );
}
