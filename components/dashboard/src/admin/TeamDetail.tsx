/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { Team, TeamMemberInfo, TeamMemberRole, VALID_ORG_MEMBER_ROLES } from "@gitpod/gitpod-protocol";
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
import { Heading2 } from "../components/typography/headings";
import search from "../icons/search.svg";
import { Button } from "@podkit/buttons/Button";

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

    const attributionId = AttributionId.render(AttributionId.create(team));
    const initialize = () => {
        (async () => {
            const members = await getGitpodService().server.adminGetTeamMembers(team.id);
            if (members.length > 0) {
                setTeamMembers(members);
            }
        })();
        getGitpodService().server.adminGetBillingMode(attributionId).then(setBillingMode);
        getGitpodService().server.adminGetCostCenter(attributionId).then(setCostCenter);
        getGitpodService().server.adminGetUsageBalance(attributionId).then(setUsageBalance);
    };

    useEffect(initialize, [team, attributionId]);

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
            <div className="flex mt-8">
                <div className="flex-1">
                    <div className="flex">
                        <Heading2>{team.name}</Heading2>
                        {team.markedDeleted && (
                            <span className="mt-2">
                                <Label text="Deleted" color="red" />
                            </span>
                        )}
                    </div>
                    <span className="mb-6 text-gray-400">{team.id}</span>
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
            <div className="flex">
                <div className="flex mt-3 pb-3">
                    <div className="flex relative h-10 my-auto">
                        <img
                            src={search}
                            title="Search"
                            className="filter-grayscale absolute top-3 left-3"
                            alt="search icon"
                        />
                        <input
                            className="w-64 pl-9 border-0"
                            type="search"
                            placeholder="Search Members"
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </div>
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
                                        entries={VALID_ORG_MEMBER_ROLES.map((role) => ({
                                            title: role,
                                            onClick: () => setTeamMemberRole(m.userId, role),
                                        }))}
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
                buttons={[
                    <Button
                        disabled={usageLimit === costCenter?.spendingLimit}
                        onClick={async () => {
                            if (usageLimit !== undefined) {
                                await getGitpodService().server.adminSetUsageLimit(attributionId, usageLimit || 0);
                                setUsageLimit(undefined);
                                initialize();
                                setEditSpendingLimit(false);
                            }
                        }}
                    >
                        Change
                    </Button>,
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
                visible={editAddCreditNote}
                onClose={() => setEditAddCreditNote(false)}
                title="Add Credits"
                buttons={[
                    <Button
                        disabled={creditNote.credits === 0 || !creditNote.note}
                        onClick={async () => {
                            if (creditNote.credits !== 0 && !!creditNote.note) {
                                await getGitpodService().server.adminAddUsageCreditNote(
                                    attributionId,
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
                    </Button>,
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
