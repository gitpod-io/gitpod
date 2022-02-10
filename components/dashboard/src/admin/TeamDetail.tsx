/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import moment from "moment";
import { useEffect, useState } from "react";
import { Team, TeamMemberInfo, TeamMemberRole } from "@gitpod/gitpod-protocol";
import { getGitpodService } from "../service/service";
import { Item, ItemField, ItemsList } from "../components/ItemsList";
import DropDown from "../components/DropDown";
import { Link } from "react-router-dom";
import Label from "./Label";
import Property from "./Property";

export default function TeamDetail(props: { team: Team }) {
    const { team } = props;
    const [teamMembers, setTeamMembers] = useState<TeamMemberInfo[] | undefined>(undefined);
    const [searchText, setSearchText] = useState<string>('');

    useEffect(() => {
        (async () => {
            const members = await getGitpodService().server.adminGetTeamMembers(team.id);
            if (members.length > 0) {
                setTeamMembers(members)
            }
        })();
    }, [team]);

    const filteredMembers = teamMembers?.filter(m => {
        const memberSearchText = `${m.fullName || ''}${m.primaryEmail || ''}`.toLocaleLowerCase();
        if (!memberSearchText.includes(searchText.toLocaleLowerCase())) {
            return false;
        }
        return true;
    });

    const setTeamMemberRole = async (userId: string, role: TeamMemberRole) => {
        await getGitpodService().server.adminSetTeamMemberRole(team!.id, userId, role);
        setTeamMembers(await getGitpodService().server.adminGetTeamMembers(team!.id));
    }
    return <>
        <div className="flex">
            <div className="flex-1">
                <div className="flex"><h3>{team.name}</h3>
                    {team.markedDeleted && <span className="mt-2"><Label text='Deleted' color="red" /></span>}
                </div>
                <span className="mb-6 text-gray-400">/t/{team.slug}</span>
                <span className="text-gray-400"> · </span>
                <span className="text-gray-400">Created on {moment(team.creationTime).format('MMM D, YYYY')}</span>
            </div>
        </div>
        <div className="flex mt-6">
            {!team.markedDeleted && teamMembers &&
            <Property name="Members">{teamMembers.length}</Property>}
        </div>
        <div className="flex mt-4">
            <div className="flex">
                <div className="py-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="16" height="16"><path fill="#A8A29E" d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z" /></svg>
                </div>
                <input type="search" placeholder="Search Members" onChange={e => setSearchText(e.target.value)} />
            </div>
        </div>

        <ItemsList className="mt-2">
            <Item header={true} className="grid grid-cols-3">
                <ItemField className="my-auto">
                    <span className="pl-14">Name</span>
                </ItemField>
                <ItemField className="flex items-center space-x-1 my-auto">
                    <span>Joined</span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" className="h-4 w-4" viewBox="0 0 16 16"><path fill="#A8A29E" fill-rule="evenodd" d="M13.366 8.234a.8.8 0 010 1.132l-4.8 4.8a.8.8 0 01-1.132 0l-4.8-4.8a.8.8 0 111.132-1.132L7.2 11.67V2.4a.8.8 0 111.6 0v9.269l3.434-3.435a.8.8 0 011.132 0z" clip-rule="evenodd" /></svg>
                </ItemField>
                <ItemField className="flex items-center my-auto">
                    <span className="flex-grow">Role</span>
                </ItemField>
            </Item>
            {team.markedDeleted || (!filteredMembers || filteredMembers.length === 0)
                ? <p className="pt-16 text-center">No members found</p>
                : filteredMembers && filteredMembers.map(m => <Item className="grid grid-cols-3" key={m.userId}>
                    <ItemField className="flex items-center my-auto">
                        <div className="w-14">{m.avatarUrl && <img className="rounded-full w-8 h-8" src={m.avatarUrl || ''} alt={m.fullName} />}</div>
                        <Link to={"/admin/users/" + m.userId}><div>
                            <div className="text-base text-gray-900 dark:text-gray-50 font-medium">{m.fullName}</div>
                            <p>{m.primaryEmail}</p>
                        </div></Link>
                    </ItemField>
                    <ItemField className="my-auto">
                        <span className="text-gray-400">{moment(m.memberSince).fromNow()}</span>
                    </ItemField>
                    <ItemField className="flex items-center my-auto">
                        <span className="text-gray-400 capitalize">
                            <DropDown contextMenuWidth="w-32" activeEntry={m.role} entries={[{
                                title: 'owner',
                                onClick: () => setTeamMemberRole(m.userId, 'owner')
                            }, {
                                title: 'member',
                                onClick: () => setTeamMemberRole(m.userId, 'member')
                            }]} />
                        </span>
                    </ItemField>
                </Item>)}
        </ItemsList>
    </>
}
