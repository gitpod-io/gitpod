/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { Team, TeamMemberInfo, TeamMemberRole } from "@gitpod/gitpod-protocol";
import { getGitpodService } from "../service/service";
import { Item, ItemField, ItemsList } from "../components/ItemsList";
import DropDown from "../components/DropDown";
import { Link } from "react-router-dom";
import Label from "./Label";
import Property from "./Property";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { CostCenterJSON, CostCenter_BillingStrategy } from "@gitpod/gitpod-protocol/lib/usage";
import Modal from "../components/Modal";

export default function TeamDetail(props: { team: Team }) {
    const { team } = props;
    const [teamMembers, setTeamMembers] = useState<TeamMemberInfo[] | undefined>(undefined);
    const [billingMode, setBillingMode] = useState<BillingMode | undefined>(undefined);
    const [searchText, setSearchText] = useState<string>("");
    const [costCenter, setCostCenter] = useState<CostCenterJSON>();
    const [usageBalance, setUsageBalance] = useState<number>(0);
    const [usageLimit, setUsageLimit] = useState<number>();
    const [editSpendingLimit, setEditSpendingLimit] = useState<boolean>(false);
    const [creditNote, setCreditNote] = useState<{ credits: number; note?: string }>({ credits: 0 });
    const [editAddCreditNote, setEditAddCreditNote] = useState<boolean>(false);

    const initialize = () => {
        (async () => {
            const members = await getGitpodService().server.adminGetTeamMembers(team.id);
            if (members.length > 0) {
                setTeamMembers(members);
            }
        })();
        getGitpodService()
            .server.adminGetBillingMode(AttributionId.render({ kind: "team", teamId: team.id }))
            .then((bm) => setBillingMode(bm));
        const attributionId = AttributionId.render(AttributionId.create(team));
        getGitpodService().server.adminGetBillingMode(attributionId).then(setBillingMode);
        getGitpodService().server.adminGetCostCenter(attributionId).then(setCostCenter);
        getGitpodService().server.adminGetUsageBalance(attributionId).then(setUsageBalance);
    };

    useEffect(initialize, [team]);

    useEffect(() => {
        if (!costCenter) {
            return;
        }
        setUsageLimit(costCenter.spendingLimit);
    }, [costCenter]);

    const filteredMembers = teamMembers?.filter((m) => {
        const memberSearchText = `${m.fullName || ""}${m.primaryEmail || ""}`.toLocaleLowerCase();
        if (!memberSearchText.includes(searchText.toLocaleLowerCase())) {
            return false;
        }
        return true;
    });

    const setTeamMemberRole = async (userId: string, role: TeamMemberRole) => {
        await getGitpodService().server.adminSetTeamMemberRole(team!.id, userId, role);
        setTeamMembers(await getGitpodService().server.adminGetTeamMembers(team!.id));
    };
    return (
        <>
            <div className="flex">
                <div className="flex-1">
                    <div className="flex">
                        <h3>{team.name}</h3>
                        {team.markedDeleted && (
                            <span className="mt-2">
                                <Label text="Deleted" color="red" />
                            </span>
                        )}
                    </div>
                    <span className="mb-6 text-gray-400">/t/{team.slug}</span>
                    <span className="text-gray-400"> · </span>
                    <span className="text-gray-400">Created on {dayjs(team.creationTime).format("MMM D, YYYY")}</span>
                </div>
            </div>
            <div className="flex mt-6">
                {!team.markedDeleted && <Property name="Members">{teamMembers?.length || "?"}</Property>}
                {!team.markedDeleted && <Property name="Billing Mode">{billingMode?.mode || "---"}</Property>}
                {costCenter && (
                    <Property name="Stripe Subscription" actions={[]}>
                        <span>
                            {costCenter?.billingStrategy === CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE
                                ? "Active"
                                : "Inactive"}
                        </span>
                    </Property>
                )}
            </div>
            <div className="flex mt-6">
                {costCenter && (
                    <Property name="Current Cycle" actions={[]}>
                        <span>
                            {dayjs(costCenter?.billingCycleStart).format("MMM D")} -{" "}
                            {dayjs(costCenter?.nextBillingTime).format("MMM D")}
                        </span>
                    </Property>
                )}
                {costCenter && (
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
                    </Property>
                )}
                {costCenter && (
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
                    </Property>
                )}
            </div>
            <div className="flex mt-4">
                <div className="flex">
                    <div className="py-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="16" height="16">
                            <path
                                fill="#A8A29E"
                                d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z"
                            />
                        </svg>
                    </div>
                    <input type="search" placeholder="Search Members" onChange={(e) => setSearchText(e.target.value)} />
                </div>
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
                {team.markedDeleted || !filteredMembers || filteredMembers.length === 0 ? (
                    <p className="pt-16 text-center">No members found</p>
                ) : (
                    filteredMembers &&
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
                                <Link to={"/admin/users/" + m.userId}>
                                    <div>
                                        <div className="text-base text-gray-900 dark:text-gray-50 font-medium">
                                            {m.fullName}
                                        </div>
                                        <p>{m.primaryEmail}</p>
                                    </div>
                                </Link>
                            </ItemField>
                            <ItemField className="my-auto">
                                <span className="text-gray-400">{dayjs(m.memberSince).fromNow()}</span>
                            </ItemField>
                            <ItemField className="flex items-center my-auto">
                                <span className="text-gray-400 capitalize">
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
                                </span>
                            </ItemField>
                        </Item>
                    ))
                )}
            </ItemsList>
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
                                    AttributionId.render(AttributionId.create(team)),
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
                        className="w-full"
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
                                    AttributionId.render(AttributionId.create(team)),
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
                        className="w-full"
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
                        className="w-full"
                        title="Note"
                        onChange={(event) => setCreditNote({ credits: creditNote.credits, note: event.target.value })}
                    />
                </div>
            </Modal>
        </>
    );
}
