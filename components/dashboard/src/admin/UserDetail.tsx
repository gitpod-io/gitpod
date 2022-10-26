/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {
    NamedWorkspaceFeatureFlag,
    Permissions,
    RoleOrPermission,
    Roles,
    User,
    WorkspaceFeatureFlags,
} from "@gitpod/gitpod-protocol";
import { AccountStatement, Subscription } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { Plans } from "@gitpod/gitpod-protocol/lib/plans";
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";
import CheckBox from "../components/CheckBox";
import Modal from "../components/Modal";
import { getGitpodService } from "../service/service";
import { WorkspaceSearch } from "./WorkspacesSearch";
import Property from "./Property";
import { PageWithAdminSubMenu } from "./PageWithAdminSubMenu";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import CaretDown from "../icons/CaretDown.svg";
import ContextMenu from "../components/ContextMenu";

export default function UserDetail(p: { user: User }) {
    const [activity, setActivity] = useState(false);
    const [user, setUser] = useState(p.user);
    const [billingMode, setBillingMode] = useState<BillingMode | undefined>(undefined);
    const [accountStatement, setAccountStatement] = useState<AccountStatement>();
    const [isStudent, setIsStudent] = useState<boolean>();
    const [editFeatureFlags, setEditFeatureFlags] = useState(false);
    const [editRoles, setEditRoles] = useState(false);
    const userRef = useRef(user);

    const isProfessionalOpenSource =
        accountStatement && accountStatement.subscriptions.some((s) => s.planId === Plans.FREE_OPEN_SOURCE.chargebeeId);

    useEffect(() => {
        setUser(p.user);
        getGitpodService()
            .server.adminGetAccountStatement(p.user.id)
            .then((as) => setAccountStatement(as))
            .catch((e) => {
                console.error(e);
            });
        getGitpodService()
            .server.adminIsStudent(p.user.id)
            .then((isStud) => setIsStudent(isStud));
        getGitpodService()
            .server.adminGetBillingMode(AttributionId.render({ kind: "user", userId: p.user.id }))
            .then((bm) => setBillingMode(bm));
    }, [p.user]);

    const email = User.getPrimaryEmail(p.user);
    const emailDomain = email ? email.split("@")[email.split("@").length - 1] : undefined;

    const updateUser: UpdateUserFunction = async (fun) => {
        setActivity(true);
        try {
            setUser(await fun(userRef.current));
        } finally {
            setActivity(false);
        }
    };

    const addStudentDomain = async () => {
        if (!emailDomain) {
            console.log("cannot add student's email domain because there is none!");
            return;
        }

        await updateUser(async (u) => {
            await getGitpodService().server.adminAddStudentEmailDomain(u.id, emailDomain);
            await getGitpodService()
                .server.adminIsStudent(u.id)
                .then((isStud) => setIsStudent(isStud));
            return u;
        });
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

    const downloadAccountStatement = async () => {
        if (!accountStatement) {
            return;
        }
        try {
            const blob = new Blob([JSON.stringify(accountStatement)], { type: "application/json" });
            const fileDownloadUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = fileDownloadUrl;
            link.setAttribute("download", "AccountStatement.json");
            document.body.appendChild(link);
            link.click();
        } catch (error) {
            console.error(`Error downloading account statement `, error);
        }
    };

    function renderUserBillingProperties(): JSX.Element {
        if (billingMode?.mode === "none") {
            return <></>; // nothing to show here atm
        }

        const properties: JSX.Element[] = [
            <Property
                name="Student"
                actions={
                    !isStudent && emailDomain && !["gmail.com", "yahoo.com", "hotmail.com"].includes(emailDomain)
                        ? [
                              {
                                  label: `Make '${emailDomain}' a student domain`,
                                  onClick: addStudentDomain,
                              },
                          ]
                        : undefined
                }
            >
                {isStudent === undefined ? "---" : isStudent ? "Enabled" : "Disabled"}
            </Property>,
            renderBillingModeProperty(billingMode),
        ];

        switch (billingMode?.mode) {
            case "chargebee":
                properties.push(
                    <Property
                        name="Remaining Hours"
                        actions={
                            accountStatement && [
                                {
                                    label: "Download Account Statement",
                                    onClick: () => downloadAccountStatement(),
                                },
                                {
                                    label: "Grant 20 Extra Hours",
                                    onClick: async () => {
                                        await getGitpodService().server.adminGrantExtraHours(user.id, 20);
                                        setAccountStatement(
                                            await getGitpodService().server.adminGetAccountStatement(user.id),
                                        );
                                    },
                                },
                            ]
                        }
                    >
                        {accountStatement?.remainingHours ? accountStatement?.remainingHours.toString() : "---"}
                    </Property>,
                );
                properties.push(
                    <Property
                        name="Plan"
                        actions={
                            accountStatement && [
                                {
                                    label: (isProfessionalOpenSource ? "Disable" : "Enable") + " Professional OSS",
                                    onClick: async () => {
                                        await getGitpodService().server.adminSetProfessionalOpenSource(
                                            user.id,
                                            !isProfessionalOpenSource,
                                        );
                                        setAccountStatement(
                                            await getGitpodService().server.adminGetAccountStatement(user.id),
                                        );
                                    },
                                },
                            ]
                        }
                    >
                        {accountStatement?.subscriptions
                            ? accountStatement.subscriptions
                                  .filter((s) => !s.deleted && Subscription.isActive(s, new Date().toISOString()))
                                  .map((s) => Plans.getById(s.planId)?.name)
                                  .join(", ")
                            : "---"}
                    </Property>,
                );
                break;
            case "usage-based":
                // TODO(gpl) Add info about Stripe plan, etc.
                break;
            default:
                break;
        }

        // Split properties into rows of 3
        const rows: JSX.Element[] = [];
        while (properties.length > 0) {
            const row = properties.splice(0, 3);
            rows.push(<div className="flex w-full mt-6">{row}</div>);
        }
        return <>{rows}</>;
    }

    return (
        <>
            <PageWithAdminSubMenu title="Users" subtitle="Search and manage all users.">
                <div className="flex">
                    <div className="flex-1">
                        <div className="flex">
                            <h3>{user.fullName}</h3>
                            {user.blocked ? <Label text="Blocked" color="red" /> : null}{" "}
                            {user.markedDeleted ? <Label text="Deleted" color="red" /> : null}
                            {user.lastVerificationTime ? <Label text="Verified" color="green" /> : null}
                        </div>
                        <p>
                            {user.identities
                                .map((i) => i.primaryEmail)
                                .filter((e) => !!e)
                                .join(", ")}
                        </p>
                    </div>
                    {!user.lastVerificationTime ? (
                        <button className="secondary danger ml-3" disabled={activity} onClick={verifyUser}>
                            Verify User
                        </button>
                    ) : null}
                    <button className="secondary danger ml-3" disabled={activity} onClick={toggleBlockUser}>
                        {user.blocked ? "Unblock" : "Block"} User
                    </button>
                    <button className="danger ml-3" disabled={activity} onClick={deleteUser}>
                        Delete User
                    </button>
                </div>
                <div className="flex mt-6">
                    <div className="w-40">
                        <img className="rounded-full h-28 w-28" alt={user.fullName} src={user.avatarUrl} />
                    </div>
                    <div className="flex flex-col w-full">
                        <div className="flex w-full mt-6">
                            <Property name="Sign Up Date">{dayjs(user.creationDate).format("MMM D, YYYY")}</Property>
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
                        {renderUserBillingProperties()}
                    </div>
                </div>
                <WorkspaceSearch user={user} />
            </PageWithAdminSubMenu>
            <Modal
                visible={editFeatureFlags}
                onClose={() => setEditFeatureFlags(false)}
                title="Edit Feature Flags"
                buttons={[
                    <button className="secondary" onClick={() => setEditFeatureFlags(false)}>
                        Done
                    </button>,
                ]}
            >
                <p>Edit feature access by adding or removing feature flags for this user.</p>
                <div className="flex flex-col">
                    {flags.map((e) => (
                        <CheckBox key={e.title} title={e.title} desc="" checked={!!e.checked} onChange={e.onClick} />
                    ))}
                </div>
            </Modal>
            <Modal
                visible={editRoles}
                onClose={() => setEditRoles(false)}
                title="Edit Roles"
                buttons={[
                    <button className="secondary" onClick={() => setEditRoles(false)}>
                        Done
                    </button>,
                ]}
            >
                <p>Edit user permissions by adding or removing roles for this user.</p>
                <div className="flex flex-col">
                    {rop.map((e) => (
                        <CheckBox key={e.title} title={e.title} desc="" checked={!!e.checked} onChange={e.onClick} />
                    ))}
                </div>
            </Modal>
        </>
    );
}

function renderBillingModeProperty(billingMode?: BillingMode): JSX.Element {
    const text = billingMode?.mode || "---";

    let blockingTeamNames = [];
    if (billingMode?.mode === "chargebee" && !!billingMode.teamNames && !billingMode.canUpgradeToUBB) {
        const itemStyle = "text-gray-400 dark:text-gray-500 text-left font-normal";
        for (const teamName of billingMode.teamNames) {
            blockingTeamNames.push({ title: teamName, customFontStyle: itemStyle });
        }
    }
    return (
        <Property name="BillingMode">
            <>
                {text}
                {blockingTeamNames.length > 0 && (
                    <ContextMenu
                        menuEntries={blockingTeamNames}
                        customClasses="w-64 max-h-48 overflow-scroll mx-auto left-0 right-0"
                    >
                        <p className="flex justify-left text-gitpod-red">
                            <span>UBP blocked by:</span>
                            <img className="m-2" src={CaretDown} />
                        </p>
                    </ContextMenu>
                )}
            </>
        </Property>
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
