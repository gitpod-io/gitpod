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
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { CheckboxInputField, CheckboxListField } from "../components/forms/CheckboxInputField";
import { CostCenterJSON, CostCenter_BillingStrategy } from "@gitpod/gitpod-protocol/lib/usage";
import { Heading2, Subheading } from "../components/typography/headings";

export default function UserDetail(p: { user: User }) {
    const [activity, setActivity] = useState(false);
    const [user, setUser] = useState(p.user);
    const [billingMode, setBillingMode] = useState<BillingMode | undefined>(undefined);
    const [costCenter, setCostCenter] = useState<CostCenterJSON>();
    const [usageBalance, setUsageBalance] = useState<number>(0);
    const [usageLimit, setUsageLimit] = useState<number>();
    const [editSpendingLimit, setEditSpendingLimit] = useState<boolean>(false);
    const [creditNote, setCreditNote] = useState<{ credits: number; note?: string }>({ credits: 0 });
    const [editAddCreditNote, setEditAddCreditNote] = useState<boolean>(false);
    const [editFeatureFlags, setEditFeatureFlags] = useState(false);
    const [editRoles, setEditRoles] = useState(false);
    const userRef = useRef(user);

    const initialize = () => {
        setUser(user);
        const attributionId = AttributionId.render(AttributionId.create(user));
        getGitpodService().server.adminGetBillingMode(attributionId).then(setBillingMode);
        getGitpodService().server.adminGetCostCenter(attributionId).then(setCostCenter);
        getGitpodService().server.adminGetUsageBalance(attributionId).then(setUsageBalance);
    };
    useEffect(initialize, [user]);

    useEffect(() => {
        if (!costCenter) {
            return;
        }
        setUsageLimit(costCenter.spendingLimit);
    }, [costCenter, user]);

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

    function renderUserBillingProperties(): JSX.Element {
        if (billingMode?.mode === "none") {
            return <></>; // nothing to show here atm
        }

        const properties: JSX.Element[] = [renderBillingModeProperty(billingMode)];

        switch (billingMode?.mode) {
            case "usage-based":
                properties.push(
                    <Property name="Stripe Subscription" actions={[]}>
                        <span>
                            {costCenter?.billingStrategy === CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE
                                ? "Active"
                                : "Inactive"}
                        </span>
                    </Property>,
                );
                properties.push(
                    <Property name="Current Cycle" actions={[]}>
                        <span>
                            {dayjs(costCenter?.billingCycleStart).format("MMM D")} -{" "}
                            {dayjs(costCenter?.nextBillingTime).format("MMM D")}
                        </span>
                    </Property>,
                );
                properties.push(
                    <Property
                        name="Available Credits"
                        actions={[
                            {
                                label: "Add Credits",
                                onClick: () => setEditAddCreditNote(true),
                            },
                        ]}
                    >
                        <span>{usageBalance * -1 + (costCenter?.spendingLimit || 0)} Credits</span>
                    </Property>,
                    <Property
                        name="Usage Limit"
                        actions={[
                            {
                                label: "Change Usage Limit",
                                onClick: () => setEditSpendingLimit(true),
                            },
                        ]}
                    >
                        <span>{costCenter?.spendingLimit} Credits</span>
                    </Property>,
                );
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
                            <button className="secondary ml-3" disabled={activity} onClick={verifyUser}>
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
                            {renderUserBillingProperties()}
                        </div>
                    </div>
                </div>

                <WorkspaceSearch user={user} />
            </AdminPageHeader>
            <Modal
                visible={editSpendingLimit}
                onClose={() => setEditSpendingLimit(false)}
                title="Change Usage Limit"
                onEnter={() => false}
                buttons={[
                    <button
                        disabled={usageLimit === costCenter?.spendingLimit}
                        onClick={async () => {
                            if (usageLimit !== undefined) {
                                await getGitpodService().server.adminSetUsageLimit(
                                    AttributionId.render(AttributionId.create(user)),
                                    usageLimit || 0,
                                );
                                setUsageLimit(undefined);
                                initialize();
                                setEditSpendingLimit(false);
                            }
                        }}
                    >
                        Change
                    </button>,
                ]}
            >
                <p className="pb-4 text-gray-500 text-base">Change the usage limit in credits per month.</p>
                <label>Credits</label>
                <div className="flex flex-col">
                    <input
                        type="number"
                        min={Math.max(usageBalance, 0)}
                        max={500000}
                        title="Change Usage Limit"
                        value={usageLimit}
                        onChange={(event) => setUsageLimit(Number.parseInt(event.target.value))}
                    />
                </div>
            </Modal>
            <Modal
                onEnter={() => false}
                visible={editAddCreditNote}
                onClose={() => setEditAddCreditNote(false)}
                title="Add Credits"
                buttons={[
                    <button
                        disabled={creditNote.credits === 0 || !creditNote.note}
                        onClick={async () => {
                            if (creditNote.credits !== 0 && !!creditNote.note) {
                                await getGitpodService().server.adminAddUsageCreditNote(
                                    AttributionId.render(AttributionId.create(user)),
                                    creditNote.credits,
                                    creditNote.note,
                                );
                                setEditAddCreditNote(false);
                                setCreditNote({ credits: 0 });
                                initialize();
                            }
                        }}
                    >
                        Add Credits
                    </button>,
                ]}
            >
                <p>Adds or subtracts the amount of credits from this account.</p>
                <div className="flex flex-col">
                    <label className="mt-4">Credits</label>
                    <input
                        type="number"
                        min={-50000}
                        max={50000}
                        title="Credits"
                        value={creditNote.credits}
                        onChange={(event) =>
                            setCreditNote({ credits: Number.parseInt(event.target.value), note: creditNote.note })
                        }
                    />
                    <label className="mt-4">Note</label>
                    <textarea
                        title="Note"
                        onChange={(event) => setCreditNote({ credits: creditNote.credits, note: event.target.value })}
                    />
                </div>
            </Modal>
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
                    <button className="secondary" onClick={() => setEditRoles(false)}>
                        Done
                    </button>,
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

function renderBillingModeProperty(billingMode?: BillingMode): JSX.Element {
    const text = billingMode?.mode || "---";

    return (
        <Property name="Billing Mode">
            <>{text}</>
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
