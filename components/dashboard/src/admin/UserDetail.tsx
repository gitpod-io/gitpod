/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    NamedWorkspaceFeatureFlag,
    Permissions,
    RoleOrPermission,
    Roles,
    User,
    WorkspaceFeatureFlags,
} from "@gitpod/gitpod-protocol";
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";
import Modal from "../components/Modal";
import { getGitpodService } from "../service/service";
import { WorkspaceSearch } from "./WorkspacesSearch";
import Property from "./Property";
import { AdminPageHeader } from "./AdminPageHeader";
import { CheckboxInputField, CheckboxListField } from "../components/forms/CheckboxInputField";
import { Heading2, Subheading } from "../components/typography/headings";
import { Button } from "@podkit/buttons/Button";

export default function UserDetail(p: { user: User }) {
    const [activity, setActivity] = useState(false);
    const [user, setUser] = useState(p.user);
    const [editFeatureFlags, setEditFeatureFlags] = useState(false);
    const [editRoles, setEditRoles] = useState(false);
    const userRef = useRef(user);

    const initialize = () => {
        setUser(user);
    };
    useEffect(initialize, [user]);

    const updateUser: UpdateUserFunction = async (fun) => {
        setActivity(true);
        try {
            setUser(await fun(userRef.current));
        } finally {
            setActivity(false);
        }
    };

    const verifyUser = async () => {
        await updateUser(async (u) => {
            return await getGitpodService().server.adminVerifyUser(u.id);
        });
    };

    const toggleBlockUser = async () => {
        await updateUser(async (u) => {
            u.blocked = !u.blocked;
            await getGitpodService().server.adminBlockUser({
                blocked: u.blocked,
                id: u.id,
            });
            return u;
        });
    };

    const deleteUser = async () => {
        await updateUser(async (u) => {
            u.markedDeleted = !u.markedDeleted;
            await getGitpodService().server.adminDeleteUser(u.id);
            return u;
        });
    };

    const flags = getFlags(user, updateUser);
    const rop = getRopEntries(user, updateUser);

    return (
        <>
            <AdminPageHeader title="Admin" subtitle="Configure and manage instance settings.">
                <div className="app-container">
                    <div className="flex mt-8">
                        <div className="flex-1">
                            <div className="flex">
                                <Heading2>{user.fullName}</Heading2>
                                {user.blocked ? <Label text="Blocked" color="red" /> : null}{" "}
                                {user.markedDeleted ? <Label text="Deleted" color="red" /> : null}
                                {user.lastVerificationTime ? <Label text="Verified" color="green" /> : null}
                            </div>
                            <Subheading>
                                {user.identities
                                    .map((i) => i.primaryEmail)
                                    .filter((e) => !!e)
                                    .join(", ")}
                                {user.verificationPhoneNumber ? ` — ${user.verificationPhoneNumber}` : null}
                            </Subheading>
                        </div>
                        {!user.lastVerificationTime ? (
                            <Button variant="secondary" className="ml-3" disabled={activity} onClick={verifyUser}>
                                Verify User
                            </Button>
                        ) : null}
                        <Button variant="destructive" className="ml-3" disabled={activity} onClick={toggleBlockUser}>
                            {user.blocked ? "Unblock" : "Block"} User
                        </Button>
                        <Button variant="destructive" className="ml-3" disabled={activity} onClick={deleteUser}>
                            Delete User
                        </Button>
                    </div>
                    <div className="flex mt-6">
                        <div className="w-40">
                            <img className="rounded-full h-28 w-28" alt={user.fullName} src={user.avatarUrl} />
                        </div>
                        <div className="flex flex-col w-full">
                            <div className="flex w-full mt-6">
                                <Property name="Sign Up Date">
                                    {dayjs(user.creationDate).format("MMM D, YYYY")}
                                </Property>
                                <Property
                                    name="Feature Flags"
                                    actions={[
                                        {
                                            label: "Edit Feature Flags",
                                            onClick: () => {
                                                setEditFeatureFlags(true);
                                            },
                                        },
                                    ]}
                                >
                                    {user.featureFlags?.permanentWSFeatureFlags?.join(", ") || "---"}
                                </Property>
                                <Property
                                    name="Roles"
                                    actions={[
                                        {
                                            label: "Edit Roles",
                                            onClick: () => {
                                                setEditRoles(true);
                                            },
                                        },
                                    ]}
                                >
                                    {user.rolesOrPermissions?.join(", ") || "---"}
                                </Property>
                            </div>
                        </div>
                    </div>
                </div>

                <WorkspaceSearch user={user} />
            </AdminPageHeader>

            <Modal
                visible={editFeatureFlags}
                onClose={() => setEditFeatureFlags(false)}
                title="Edit Feature Flags"
                buttons={[
                    <Button variant="secondary" onClick={() => setEditFeatureFlags(false)}>
                        Done
                    </Button>,
                ]}
            >
                <CheckboxListField
                    label="Edit feature access by adding or removing feature flags for this user."
                    className="mt-0"
                >
                    {flags.map((e) => (
                        <CheckboxInputField
                            key={e.title}
                            label={e.title}
                            checked={!!e.checked}
                            topMargin={false}
                            onChange={e.onClick}
                        />
                    ))}
                </CheckboxListField>
            </Modal>
            <Modal
                visible={editRoles}
                onClose={() => setEditRoles(false)}
                title="Edit Roles"
                buttons={[
                    <Button variant="secondary" onClick={() => setEditRoles(false)}>
                        Done
                    </Button>,
                ]}
            >
                <CheckboxListField
                    label="Edit user permissions by adding or removing roles for this user."
                    className="mt-0"
                >
                    {rop.map((e) => (
                        <CheckboxInputField
                            key={e.title}
                            label={e.title}
                            checked={!!e.checked}
                            topMargin={false}
                            onChange={e.onClick}
                        />
                    ))}
                </CheckboxListField>
            </Modal>
        </>
    );
}

function Label(p: { text: string; color: string }) {
    return (
        <div className={`ml-3 text-sm text-${p.color}-600 truncate bg-${p.color}-100 px-1.5 py-0.5 rounded-md my-auto`}>
            {p.text}
        </div>
    );
}

interface Entry {
    title: string;
    checked: boolean;
    onClick: () => void;
}

type UpdateUserFunction = (fun: (u: User) => Promise<User>) => Promise<void>;

function getFlags(user: User, updateUser: UpdateUserFunction): Entry[] {
    return Object.entries(WorkspaceFeatureFlags)
        .map((e) => e[0] as NamedWorkspaceFeatureFlag)
        .map((name) => {
            const checked = !!user.featureFlags?.permanentWSFeatureFlags?.includes(name);
            return {
                title: name,
                checked,
                onClick: async () => {
                    await updateUser(async (u) => {
                        return await getGitpodService().server.adminModifyPermanentWorkspaceFeatureFlag({
                            id: user.id,
                            changes: [
                                {
                                    featureFlag: name,
                                    add: !checked,
                                },
                            ],
                        });
                    });
                },
            };
        });
}

function getRopEntries(user: User, updateUser: UpdateUserFunction): Entry[] {
    const createRopEntry = (name: RoleOrPermission, role?: boolean) => {
        const checked = user.rolesOrPermissions?.includes(name)!!;
        return {
            title: (role ? "Role: " : "Permission: ") + name,
            checked,
            onClick: async () => {
                await updateUser(async (u) => {
                    return await getGitpodService().server.adminModifyRoleOrPermission({
                        id: user.id,
                        rpp: [
                            {
                                r: name,
                                add: !checked,
                            },
                        ],
                    });
                });
            },
        };
    };
    return [
        ...Object.entries(Permissions).map((e) => createRopEntry(e[0] as RoleOrPermission)),
        ...Object.entries(Roles).map((e) => createRopEntry(e[0] as RoleOrPermission, true)),
    ];
}
