/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { TeamMemberInfo } from "@gitpod/gitpod-protocol";
import { Currency, Plan, Plans, PlanType } from "@gitpod/gitpod-protocol/lib/plans";
import { TeamSubscription2 } from "@gitpod/gitpod-protocol/lib/team-subscription-protocol";
import React, { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { ChargebeeClient } from "../chargebee/chargebee-client";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import Card from "../components/Card";
import DropDown from "../components/DropDown";
import PillLabel from "../components/PillLabel";
import SolidCard from "../components/SolidCard";
import { ReactComponent as CheckSvg } from "../images/check.svg";
import { ReactComponent as Spinner } from "../icons/Spinner.svg";
import { PaymentContext } from "../payment-context";
import { getGitpodService } from "../service/service";
import { getCurrentTeam, TeamsContext } from "./teams-context";
import { getTeamSettingsMenu } from "./TeamSettings";

type PendingPlan = Plan & { pendingSince: number };

export default function TeamBilling() {
    const { teams } = useContext(TeamsContext);
    const location = useLocation();
    const team = getCurrentTeam(location, teams);
    const [members, setMembers] = useState<TeamMemberInfo[]>([]);
    const [teamSubscription, setTeamSubscription] = useState<TeamSubscription2 | undefined>();
    const { showPaymentUI, currency, setCurrency } = useContext(PaymentContext);
    const [pendingTeamPlan, setPendingTeamPlan] = useState<PendingPlan | undefined>();
    const [pollTeamSubscriptionTimeout, setPollTeamSubscriptionTimeout] = useState<NodeJS.Timeout | undefined>();

    console.log(
        "members",
        members.length,
        "currency",
        currency,
        "teamSubscription",
        teamSubscription,
        "pendingTeamPlan",
        pendingTeamPlan,
    );

    useEffect(() => {
        if (!team) {
            return;
        }
        (async () => {
            const [memberInfos, subscription] = await Promise.all([
                getGitpodService().server.getTeamMembers(team.id),
                getGitpodService().server.getTeamSubscription(team.id),
            ]);
            setMembers(memberInfos);
            setTeamSubscription(subscription);
        })();
    }, [team]);

    useEffect(() => {
        setPendingTeamPlan(undefined);
        if (!team) {
            return;
        }
        try {
            const pendingTeamPlanString = window.localStorage.getItem(`pendingPlanForTeam${team.id}`);
            if (!pendingTeamPlanString) {
                return;
            }
            const pending = JSON.parse(pendingTeamPlanString);
            setPendingTeamPlan(pending);
        } catch (error) {
            console.error("Could not load pending team plan", team.id, error);
        }
    }, [team]);

    useEffect(() => {
        if (!pendingTeamPlan || !team) {
            return;
        }
        if (teamSubscription && teamSubscription.planId === pendingTeamPlan.chargebeeId) {
            // The purchase was successful!
            window.localStorage.removeItem(`pendingPlanForTeam${team.id}`);
            clearTimeout(pollTeamSubscriptionTimeout!);
            setPendingTeamPlan(undefined);
            return;
        }
        if (pendingTeamPlan.pendingSince + 1000 * 60 * 5 < Date.now()) {
            // Pending team plans expire after 5 minutes
            window.localStorage.removeItem(`pendingPlanForTeam${team.id}`);
            clearTimeout(pollTeamSubscriptionTimeout!);
            setPendingTeamPlan(undefined);
            return;
        }
        if (!pollTeamSubscriptionTimeout) {
            // Refresh team subscription in 5 seconds in order to poll for purchase confirmation
            const timeout = setTimeout(async () => {
                const ts = await getGitpodService().server.getTeamSubscription(team.id);
                setTeamSubscription(ts);
                setPollTeamSubscriptionTimeout(undefined);
            }, 5000);
            setPollTeamSubscriptionTimeout(timeout);
        }
        return function cleanup() {
            clearTimeout(pollTeamSubscriptionTimeout!);
        };
    }, [pendingTeamPlan, pollTeamSubscriptionTimeout, team, teamSubscription]);

    const availableTeamPlans = Plans.getAvailableTeamPlans(currency || "USD").filter((p) => p.type !== "student");

    const checkout = async (plan: Plan) => {
        if (!team || members.length < 1) {
            return;
        }
        const chargebeeClient = await ChargebeeClient.getOrCreate(team.id);
        await new Promise((resolve, reject) => {
            chargebeeClient.checkout((paymentServer) => paymentServer.teamCheckout(team.id, plan.chargebeeId), {
                success: resolve,
                error: reject,
            });
        });
        const pending = {
            ...plan,
            pendingSince: Date.now(),
        };
        setPendingTeamPlan(pending);
        window.localStorage.setItem(`pendingPlanForTeam${team.id}`, JSON.stringify(pending));
    };

    const isLoading = members.length === 0;
    const teamPlan = pendingTeamPlan || Plans.getById(teamSubscription?.planId);

    const featuresByPlanType: { [type in PlanType]?: Array<React.ReactNode> } = {
        // Team Professional
        "professional-new": [
            <span>Public &amp; Private Repositories</span>,
            <span>8 Parallel Workspaces</span>,
            <span>30 min Inactivity Timeout</span>,
        ],
        // Team Unleaashed
        professional: [
            <span>Public &amp; Private Repositories</span>,
            <span>16 Parallel Workspaces</span>,
            <span>1 hr Inactivity Timeout</span>,
            <span>3 hr Timeout Boost</span>,
        ],
    };

    return (
        <PageWithSubMenu
            subMenu={getTeamSettingsMenu({ team, showPaymentUI })}
            title="Billing"
            subtitle="Manage team billing and plans."
        >
            <h3>{!teamPlan ? "No billing plan" : "Plan"}</h3>
            <h2 className="text-gray-500">
                {!teamPlan ? (
                    <div className="flex space-x-1">
                        <span>Select a new billing plan for this team. Currency:</span>
                        <DropDown
                            contextMenuWidth="w-32"
                            activeEntry={currency}
                            entries={[
                                {
                                    title: "EUR",
                                    onClick: () => setCurrency("EUR"),
                                },
                                {
                                    title: "USD",
                                    onClick: () => setCurrency("USD"),
                                },
                            ]}
                        />
                    </div>
                ) : (
                    <span>
                        This team is currently on the <strong>{teamPlan.name}</strong> plan.
                    </span>
                )}
            </h2>
            <div className="mt-4 space-x-4 flex">
                {isLoading && (
                    <>
                        <SolidCard>
                            <div className="w-full h-full flex flex-col items-center justify-center">
                                <Spinner className="h-5 w-5 animate-spin" />
                            </div>
                        </SolidCard>
                        <SolidCard>
                            <div className="w-full h-full flex flex-col items-center justify-center">
                                <Spinner className="h-5 w-5 animate-spin" />
                            </div>
                        </SolidCard>
                    </>
                )}
                {!isLoading && !teamPlan && (
                    <>
                        {availableTeamPlans.map((tp) => (
                            <>
                                <SolidCard
                                    className="cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                                    onClick={() => checkout(tp)}
                                >
                                    <div className="px-2 py-5 flex-grow flex flex-col">
                                        <div className="font-medium text-base">{tp.name}</div>
                                        <div className="font-semibold text-gray-500 text-sm">Unlimited hours</div>
                                        <div className="mt-8 font-semibold text-sm">Includes:</div>
                                        <div className="flex flex-col items-start text-sm">
                                            {(featuresByPlanType[tp.type] || []).map((f) => (
                                                <span className="inline-flex space-x-1">
                                                    <CheckSvg fill="currentColor" className="self-center mt-1" />
                                                    {f}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex-grow flex flex-col items-end justify-end">
                                            <PillLabel type="warn" className="font-semibold normal-case text-sm">
                                                {members.length} x {Currency.getSymbol(tp.currency)}
                                                {tp.pricePerMonth} = {Currency.getSymbol(tp.currency)}
                                                {members.length * tp.pricePerMonth} per month
                                            </PillLabel>
                                        </div>
                                    </div>
                                </SolidCard>
                            </>
                        ))}
                    </>
                )}
                {!isLoading && teamPlan && (
                    <>
                        <Card>
                            <div className="px-2 py-5 flex-grow flex flex-col">
                                <div className="font-bold text-base">{teamPlan.name}</div>
                                <div className="font-semibold text-gray-500 text-sm">Unlimited hours</div>
                                <div className="mt-8 font-semibold text-sm">Includes:</div>
                                <div className="flex flex-col items-start text-sm">
                                    {(featuresByPlanType[teamPlan.type] || []).map((f) => (
                                        <span className="inline-flex space-x-1">
                                            <CheckSvg fill="currentColor" className="self-center mt-1" />
                                            {f}
                                        </span>
                                    ))}
                                </div>
                                <div className="flex-grow flex flex-col items-end justify-end"></div>
                            </div>
                        </Card>
                        {!teamSubscription ? (
                            <SolidCard>
                                <div className="w-full h-full flex flex-col items-center justify-center">
                                    <Spinner className="h-5 w-5 animate-spin" />
                                </div>
                            </SolidCard>
                        ) : (
                            <SolidCard>
                                <div className="px-2 py-5 flex-grow flex flex-col">
                                    <div className="font-medium text-base text-gray-400">Members</div>
                                    <div className="font-semibold text-base text-gray-600">{members.length}</div>
                                    <div className="mt-8 font-medium text-base text-gray-400">Next invoice on</div>
                                    <div className="font-semibold text-base text-gray-600">
                                        {guessNextInvoiceDate(teamSubscription.startDate).toDateString()}
                                    </div>
                                    <div className="flex-grow flex flex-col items-end justify-end">
                                        <button
                                            onClick={() => {
                                                if (team) {
                                                    ChargebeeClient.getOrCreate(team.id).then((chargebeeClient) =>
                                                        chargebeeClient.openPortal(),
                                                    );
                                                }
                                            }}
                                            className="m-0"
                                        >
                                            Manage Billing or Cancel
                                        </button>
                                    </div>
                                </div>
                            </SolidCard>
                        )}
                    </>
                )}
            </div>
        </PageWithSubMenu>
    );
}

function guessNextInvoiceDate(startDate: string): Date {
    const now = new Date();
    const date = new Date(startDate);
    while (date < now) {
        date.setMonth(date.getMonth() + 1);
    }
    return date;
}
