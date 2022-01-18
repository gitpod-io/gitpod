/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { NamedWorkspaceFeatureFlag, Permissions, RoleOrPermission, Roles, User, WorkspaceFeatureFlags } from "@gitpod/gitpod-protocol"
import { AccountStatement, Subscription } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { Plans } from "@gitpod/gitpod-protocol/lib/plans";
import moment from "moment";
import { ReactChild, useEffect, useRef, useState } from "react";
import CheckBox from "../components/CheckBox";
import Modal from "../components/Modal";
import { PageWithSubMenu } from "../components/PageWithSubMenu"
import { getGitpodService } from "../service/service";
import { adminMenu } from "./admin-menu"
import { WorkspaceSearch } from "./WorkspacesSearch";


export default function UserDetail(p: { user: User }) {
    const [activity, setActivity] = useState(false);
    const [user, setUser] = useState(p.user);
    const [accountStatement, setAccountStatement] = useState<AccountStatement>();
    const [isStudent, setIsStudent] = useState<boolean>();
    const [editFeatureFlags, setEditFeatureFlags] = useState(false);
    const [editRoles, setEditRoles] = useState(false);
    const userRef = useRef(user);

    const isProfessionalOpenSource = accountStatement && accountStatement.subscriptions.some(s => s.planId === Plans.FREE_OPEN_SOURCE.chargebeeId)

    useEffect(() => {
        setUser(p.user);
        getGitpodService().server.adminGetAccountStatement(p.user.id).then(
            as =>
                setAccountStatement(as)
        ).catch(e => {
            console.error(e);
        });
        getGitpodService().server.adminIsStudent(p.user.id).then(
            isStud => setIsStudent(isStud)
        );
    }, [p.user]);

    const email = User.getPrimaryEmail(p.user);
    const emailDomain = email.split('@')[ email.split('@').length - 1];

    const updateUser: UpdateUserFunction = async fun => {
        setActivity(true);
        try {
            setUser(await fun(userRef.current));
        } finally {
            setActivity(false);
        }
    };

    const addStudentDomain = async () => {
        await updateUser(async u => {
            await getGitpodService().server.adminAddStudentEmailDomain(u.id, emailDomain);
            await getGitpodService().server.adminIsStudent(u.id).then(
                isStud => setIsStudent(isStud)
            );
            return u;
        });
    };

    const toggleBlockUser = async () => {
        await updateUser(async u => {
            u.blocked = !u.blocked;
            await getGitpodService().server.adminBlockUser({
                blocked: u.blocked,
                id: u.id
            });
            return u;
        });
    }

    const deleteUser = async () => {
        await updateUser(async u => {
            u.markedDeleted = !u.markedDeleted;
            await getGitpodService().server.adminDeleteUser(u.id);
            return u;
        });
    }

    const flags = getFlags(user, updateUser);
    const rop = getRopEntries(user, updateUser);

    const downloadAccountStatement = async () => {
        if (!accountStatement) {
            return;
        }
        try {
            const blob = new Blob([JSON.stringify(accountStatement)], { type: 'application/json' });
            const fileDownloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = fileDownloadUrl;
            link.setAttribute('download', 'AccountStatement.json');
            document.body.appendChild(link);
            link.click();
        } catch (error) {
            console.error(`Error downloading account statement `, error);
        }
    }

    return <>
        <PageWithSubMenu subMenu={adminMenu} title="Users" subtitle="Search and manage all users.">
            <div className="flex">
                <div className="flex-1">
                    <div className="flex"><h3>{user.fullName}</h3>{user.blocked ? <Label text='Blocked' color="red" /> : null} {user.markedDeleted ? <Label text='Deleted' color="red" /> : null}</div>
                    <p>{user.identities.map(i => i.primaryEmail).filter(e => !!e).join(', ')}</p>
                </div>
                <button className="secondary danger ml-3" disabled={activity} onClick={toggleBlockUser}>{user.blocked ? 'Unblock' : 'Block'} User</button>
                <button className="danger ml-3" disabled={activity} onClick={deleteUser}>Delete User</button>
            </div>
            <div className="flex mt-6">
                <div className="w-40">
                    <img className="rounded-full h-28 w-28" alt={user.fullName} src={user.avatarUrl} />
                </div>
                <div className="flex flex-col w-full">
                    <div className="flex w-full mt-6">
                        <Property name="Sign Up Date">{moment(user.creationDate).format('MMM D, YYYY')}</Property>
                        <Property name="Remaining Hours"
                            actions={
                                accountStatement && [{
                                    label: 'Download Account Statement',
                                    onClick: () => downloadAccountStatement()
                                }, {
                                    label: 'Grant 20 Extra Hours',
                                    onClick: async () => {
                                        await getGitpodService().server.adminGrantExtraHours(user.id, 20);
                                        setAccountStatement(await getGitpodService().server.adminGetAccountStatement(user.id));
                                    }
                                }]
                            }
                        >{accountStatement?.remainingHours ? accountStatement?.remainingHours.toString() : '---'}</Property>
                        <Property
                            name="Plan"
                            actions={accountStatement && [{
                                label: (isProfessionalOpenSource ? 'Disable' : 'Enable') + ' Professional OSS',
                                onClick: async () => {
                                    await getGitpodService().server.adminSetProfessionalOpenSource(user.id, !isProfessionalOpenSource);
                                    setAccountStatement(await getGitpodService().server.adminGetAccountStatement(user.id));
                                }
                            }]}
                        >{accountStatement?.subscriptions ? accountStatement.subscriptions.filter(s => Subscription.isActive(s, new Date().toISOString())).map(s => Plans.getById(s.planId)?.name).join(', ') : '---'}</Property>
                    </div>
                    <div className="flex w-full mt-6">
                        <Property name="Feature Flags"
                            actions={[{
                                label: 'Edit Feature Flags',
                                onClick: () => {
                                    setEditFeatureFlags(true);
                                }
                            }]}
                        >{user.featureFlags?.permanentWSFeatureFlags?.join(', ') || '---'}</Property>
                        <Property name="Roles"
                            actions={[{
                                label: 'Edit Roles',
                                onClick: () => {
                                    setEditRoles(true);
                                }
                            }]}
                        >{user.rolesOrPermissions?.join(', ') || '---'}</Property>
                        <Property name="Student"
                            actions={ (!isStudent && !['gmail.com', 'yahoo.com', 'hotmail.com'].includes(emailDomain)) ? [{
                                label: `Make '${emailDomain}' a student domain`,
                                onClick: addStudentDomain
                            }] :  undefined}
                        >{isStudent === undefined ? '---' : (isStudent ? 'Enabled' : 'Disabled')}</Property>
                    </div>
                </div>
            </div>
            <WorkspaceSearch user={user} />
        </PageWithSubMenu>
        <Modal visible={editFeatureFlags} onClose={() => setEditFeatureFlags(false)} title="Edit Feature Flags" buttons={[
            <button className="secondary" onClick={() => setEditFeatureFlags(false)}>Done</button>
        ]}>
            <p>Edit feature access by adding or removing feature flags for this user.</p>
            <div className="flex flex-col">
                {
                    flags.map(e => <CheckBox key={e.title} title={e.title} desc="" checked={!!e.checked} onChange={e.onClick} />)
                }
            </div>
        </Modal>
        <Modal visible={editRoles} onClose={() => setEditRoles(false)} title="Edit Roles" buttons={[
            <button className="secondary" onClick={() => setEditRoles(false)}>Done</button>
        ]}>
            <p>Edit user permissions by adding or removing roles for this user.</p>
            <div className="flex flex-col">
                {
                    rop.map(e => <CheckBox key={e.title} title={e.title} desc="" checked={!!e.checked} onChange={e.onClick} />)
                }
            </div>
        </Modal>
    </>;
}

function Label(p: { text: string, color: string }) {
    return <div className={`ml-3 text-sm text-${p.color}-600 truncate bg-${p.color}-100 px-1.5 py-0.5 rounded-md my-auto`}>{p.text}</div>;
}

export function Property(p: { name: string, children: string | ReactChild, actions?: { label: string, onClick: () => void }[] }) {
    return <div className="ml-3 flex flex-col w-4/12 truncate">
        <div className="text-base text-gray-500 truncate">
            {p.name}
        </div>
        <div className="text-lg text-gray-600 font-semibold truncate">
            {p.children}
        </div>
        {(p.actions || []).map(a =>
            <div className="cursor-pointer text-sm text-blue-400 dark:text-blue-600 hover:text-blue-600 dark:hover:text-blue-400 truncate" onClick={a.onClick}>
                {a.label || ''}
            </div>
        )}
    </div>;
}

interface Entry {
    title: string,
    checked: boolean,
    onClick: () => void
}

type UpdateUserFunction = (fun: (u: User) => Promise<User>) => Promise<void>;

function getFlags(user: User, updateUser: UpdateUserFunction): Entry[] {
    return Object.entries(WorkspaceFeatureFlags).map(e => e[0] as NamedWorkspaceFeatureFlag).map(name => {
        const checked = !!user.featureFlags?.permanentWSFeatureFlags?.includes(name);
        return {
            title: name,
            checked,
            onClick: async () => {
                await updateUser(async u => {
                    return await getGitpodService().server.adminModifyPermanentWorkspaceFeatureFlag({
                        id: user.id,
                        changes: [
                            {
                                featureFlag: name,
                                add: !checked
                            }
                        ]
                    });
                })
            }
        };
    });
}

function getRopEntries(user: User, updateUser: UpdateUserFunction): Entry[] {
    const createRopEntry = (name: RoleOrPermission, role?: boolean) => {
        const checked = user.rolesOrPermissions?.includes(name)!!;
        return {
            title: (role ? 'Role: ' : 'Permission: ') + name,
            checked,
            onClick: async () => {
                await updateUser(async u => {
                    return await getGitpodService().server.adminModifyRoleOrPermission({
                        id: user.id,
                        rpp: [{
                            r: name,
                            add: !checked
                        }]
                    });
                })
            }
        };
    };
    return [
        ...Object.entries(Permissions).map(e => createRopEntry(e[0] as RoleOrPermission)),
        ...Object.entries(Roles).map(e => createRopEntry(e[0] as RoleOrPermission, true))
    ];
};
