/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { TeamMemberInfo, TeamMembershipInvite } from "@gitpod/gitpod-protocol";
import moment from "moment";
import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";
import Header from "../components/Header";
import DropDown from "../components/DropDown";
import { ItemsList, Item, ItemField, ItemFieldContextMenu } from "../components/ItemsList";
import Modal from "../components/Modal";
import { getGitpodService } from "../service/service";
import copy from '../images/copy.svg';
import { TeamsContext, getCurrentTeam } from "./teams-context";


export default function() {
    const { teams } = useContext(TeamsContext);
    const location = useLocation();
    const team = getCurrentTeam(location, teams);
    const [ members, setMembers ] = useState<TeamMemberInfo[]>([]);
    const [ genericInvite, setGenericInvite ] = useState<TeamMembershipInvite>();
    const [ showInviteModal, setShowInviteModal ] = useState<boolean>(false);

    useEffect(() => {
        if (!team) {
            return;
        }
        (async () => {
            const [infos, invite] = await Promise.all([
                getGitpodService().server.getTeamMembers(team.id),
                getGitpodService().server.getGenericInvite(team.id)]);

            setMembers(infos);
            setGenericInvite(invite);
        })();
    }, [ team ]);

    const getInviteURL = (inviteId: string) => {
        const link = new URL(window.location.href);
        link.pathname = '/join-team';
        link.search = '?inviteId=' + inviteId;
        return link.href;
    }

    const [ copied, setCopied ] = useState<boolean>(false);
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
        if (genericInvite) {
            setGenericInvite(undefined);
            const newInvite = await getGitpodService().server.resetGenericInvite(team!.id);
            setGenericInvite(newInvite);
        }
    }

    return <>
        <Header title="Members" subtitle="Manage team members." />
        <div className="lg:px-28 px-10">
            <div className="flex mt-8">
                <div className="flex">
                    <div className="py-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="16" height="16"><path fill="#A8A29E" d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z"/></svg>
                    </div>
                    <input type="search" placeholder="Search Members" onChange={() => { /* TODO */ }} />
                </div>
                <div className="flex-1" />
                <div className="py-3 pl-3">
                    <DropDown prefix="Role: " contextMenuWidth="w-32" activeEntry={'All'} entries={[{
                        title: 'All',
                        onClick: () => { /* TODO */ }
                    }, {
                        title: 'Owner',
                        onClick: () => { /* TODO */ }
                    }, {
                        title: 'Member',
                        onClick: () => { /* TODO */ }
                    }]} />
                </div>
                <button onClick={() => setShowInviteModal(true)} className="ml-2">Invite Members</button>
            </div>
            <ItemsList className="mt-2">
                <Item header={true} className="grid grid-cols-3">
                    <ItemField>
                        <span className="pl-14">Name</span>
                    </ItemField>
                    <ItemField>
                        <span>Joined</span>
                    </ItemField>
                    <ItemField className="flex items-center">
                        <span className="flex-grow">Role</span>
                        <ItemFieldContextMenu />
                    </ItemField>
                </Item>
                {members.map(m => <Item className="grid grid-cols-3">
                    <ItemField className="flex items-center">
                        <div className="w-14">{m.avatarUrl && <img className="rounded-full w-8 h-8" src={m.avatarUrl || ''} alt={m.fullName} />}</div>
                        <div>
                            <div className="text-base text-gray-900 dark:text-gray-50 font-medium">{m.fullName}</div>
                            <p>{m.primaryEmail}</p>
                        </div>
                    </ItemField>
                    <ItemField>
                        <span className="text-gray-400">{moment(m.memberSince).fromNow()}</span>
                    </ItemField>
                    <ItemField className="flex items-center">
                        <span className="text-gray-400 flex-grow capitalize">{m.role}</span>
                        <ItemFieldContextMenu menuEntries={[
                            {
                                title: 'Remove',
                                customFontStyle: 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300',
                                onClick: () => { /* TODO(janx) */ }
                            },
                        ]} />
                    </ItemField>
                </Item>)}
            </ItemsList>
        </div>
        {genericInvite && showInviteModal && <Modal visible={true} onClose={() => setShowInviteModal(false)}>
            <h3 className="mb-4">Invite Members</h3>
            <div className="border-t border-b border-gray-200 dark:border-gray-800 -mx-6 px-6 py-4 flex flex-col">
                <label htmlFor="inviteUrl" className="font-medium">Invite URL</label>
                <div className="w-full relative">
                    <input name="inviteUrl" disabled={true} readOnly={true} type="text" value={getInviteURL(genericInvite.id)} className="rounded-md w-full truncate pr-8" />
                    <div className="cursor-pointer" onClick={() => copyToClipboard(getInviteURL(genericInvite.id))}>
                        <img src={copy} title="Copy Invite URL" className="absolute top-1/3 right-3" />
                    </div>
                </div>
                <p className="mt-1 text-gray-500 text-sm">{copied ? 'Copied to clipboard!' : 'Use this URL to join this team as a Member.'}</p>
            </div>
            <div className="flex justify-end mt-6 space-x-2">
                <button className="secondary" onClick={() => resetInviteLink()}>Reset Invite Link</button>
                <button className="secondary" onClick={() => setShowInviteModal(false)}>Close</button>
            </div>
        </Modal>}
    </>;
}