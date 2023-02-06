/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { Currency, Plan, Plans, PlanType } from "@gitpod/gitpod-protocol/lib/plans";
import { TeamSubscription2 } from "@gitpod/gitpod-protocol/lib/team-subscription-protocol";
import React, { FunctionComponent, useCallback, useContext, useEffect, useState } from "react";
import { ChargebeeClient } from "../chargebee/chargebee-client";
import Alert from "../components/Alert";
import Card from "../components/Card";
import DropDown from "../components/DropDown";
import PillLabel from "../components/PillLabel";
import SolidCard from "../components/SolidCard";
import { useOrgBillingMode } from "../data/billing-mode/org-billing-mode-query";
import { useOrgMembers } from "../data/organizations/org-members-query";
import { getExperimentsClient } from "../experiments/client";
import { ReactComponent as Spinner } from "../icons/Spinner.svg";
import { ReactComponent as CheckSvg } from "../images/check.svg";
import { PaymentContext } from "../payment-context";
import { getGitpodService } from "../service/service";
import { useCurrentUser } from "../user-context";
import { OrgSettingsPage } from "./OrgSettingsPage";
import { useCurrentTeam } from "./teams-context";
import TeamUsageBasedBilling from "./TeamUsageBasedBilling";

type PendingPlan = Plan & { pendingSince: number };

export default function TeamBillingPage() {
    return (
        <OrgSettingsPage>
            <TeamBilling />
        </OrgSettingsPage>
    );
}

const TeamBilling: FunctionComponent = () => {
    const user = useCurrentUser();
    const team = useCurrentTeam();
    const { data: teamBillingMode, isLoading: teamBillingModeLoading } = useOrgBillingMode();
    const { data: members, isLoading: membersLoading } = useOrgMembers();
    const [teamSubscription, setTeamSubscription] = useState<TeamSubscription2 | undefined>();
    const { currency, setCurrency } = useContext(PaymentContext);
    const [isUsageBasedBillingEnabled, setIsUsageBasedBillingEnabled] = useState<boolean>(false);
    const [pendingTeamPlan, setPendingTeamPlan] = useState<PendingPlan | undefined>();
    const [pollTeamSubscriptionTimeout, setPollTeamSubscriptionTimeout] = useState<NodeJS.Timeout | undefined>();

    useEffect(() => {
        if (!team) {
            return;
        }
        (async () => {
            const subscription = await getGitpodService().server.getTeamSubscription(team.id);
            setTeamSubscription(subscription);
        })();
    }, [team, user?.id]);

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

    useEffect(() => {
        if (!team || !user) {
            return;
        }
        (async () => {
            const isEnabled = await getExperimentsClient().getValueAsync("isUsageBasedBillingEnabled", false, {
                user,
                teamId: team.id,
                teamName: team.name,
            });
            setIsUsageBasedBillingEnabled(isEnabled);
        })();
    }, [team, user]);

    const availableTeamPlans = Plans.getAvailableTeamPlans(currency || "USD").filter((p) => p.type !== "student");

    const checkout = useCallback(
        async (plan: Plan) => {
            if (!team || (members || []).length < 1) {
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
        },
        [members, team],
    );

    const isLoading = teamBillingModeLoading || membersLoading;
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

    function renderTeamBilling(): JSX.Element {
        return (
            <>
                {isUsageBasedBillingEnabled && (
                    <Alert type="message" className="mb-4">
                        To access{" "}
                        <a className="gp-link" href="https://www.gitpod.io/docs/configure/workspaces/workspace-classes">
                            large workspaces
                        </a>{" "}
                        and{" "}
                        <a className="gp-link" href="https://www.gitpod.io/docs/configure/billing/pay-as-you-go">
                            pay-as-you-go
                        </a>
                        , first cancel your existing plan. Existing plans will keep working until the end of March,
                        2023.
                    </Alert>
                )}
                <h3>{!teamPlan ? "Select Plan" : "Current Plan"}</h3>
                <h2 className="text-gray-500">
                    {!teamPlan ? (
                        <div className="flex space-x-1">
                            <span>Currency:</span>
                            <DropDown
                                customClasses="w-32"
                                renderAsLink={true}
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
                            This organization is currently on the <strong>{teamPlan.name}</strong> plan.
                        </span>
                    )}
                </h2>
                <div className="mt-4 space-x-4 flex">
                    {isLoading && (
                        <>
                            <SolidCard className="w-72 h-64">
                                <div className="w-full h-full flex flex-col items-center justify-center">
                                    <Spinner className="h-5 w-5 animate-spin" />
                                </div>
                            </SolidCard>
                            <SolidCard className="w-72 h-64">
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
                                    <SolidCard className="w-72 h-72">
                                        <div className="px-2 py-5 flex-grow flex flex-col">
                                            <div className="font-semibold text-gray-800 dark:text-gray-100 text-lg">
                                                {tp.name}
                                            </div>
                                            <div className="font-semibold text-gray-400 dark:text-gray-600 text-sm">
                                                Unlimited hours
                                            </div>
                                            <div className="mt-2">
                                                <PillLabel type="warn" className="font-semibold normal-case text-sm">
                                                    {(members || []).length} x {Currency.getSymbol(tp.currency)}
                                                    {tp.pricePerMonth} = {Currency.getSymbol(tp.currency)}
                                                    {(members || []).length * tp.pricePerMonth} per month
                                                </PillLabel>
                                            </div>
                                            <div className="mt-4 font-semibold text-sm">Includes:</div>
                                            <div className="flex flex-col items-start text-sm">
                                                {(featuresByPlanType[tp.type] || []).map((f) => (
                                                    <span className="inline-flex space-x-1">
                                                        <CheckSvg fill="currentColor" className="self-center mt-1" />
                                                        {f}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="flex-grow flex flex-col items-stretch justify-end">
                                                <button className="m-0" onClick={() => checkout(tp)}>
                                                    Select {tp.name}
                                                </button>
                                            </div>
                                        </div>
                                    </SolidCard>
                                </>
                            ))}
                        </>
                    )}
                    {!isLoading && teamPlan && (
                        <>
                            <Card className="w-72 h-64">
                                <div className="px-2 py-5 flex-grow flex flex-col">
                                    <div className="font-semibold text-gray-100 dark:text-gray-800 text-lg">
                                        {teamPlan.name}
                                    </div>
                                    <div className="font-semibold text-gray-400 dark:text-gray-600 text-sm">
                                        Unlimited hours
                                    </div>
                                    <div className="mt-8 font-semibold text-sm">Includes:</div>
                                    <div className="flex flex-col items-start text-sm">
                                        {(featuresByPlanType[teamPlan.type] || []).map((f) => (
                                            <span className="inline-flex space-x-1">
                                                <CheckSvg fill="currentColor" className="self-center mt-1" />
                                                {f}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex-grow flex flex-col items-stretch justify-end"></div>
                                </div>
                            </Card>
                            {!teamSubscription ? (
                                <SolidCard className="w-72 h-64">
                                    <div className="w-full h-full flex flex-col items-center justify-center">
                                        <Spinner className="h-5 w-5 animate-spin" />
                                    </div>
                                </SolidCard>
                            ) : (
                                <SolidCard className="w-72 h-64">
                                    <div className="px-2 py-5 flex-grow flex flex-col">
                                        <div className="font-medium text-base text-gray-400 dark:text-gray-600">
                                            Members
                                        </div>
                                        <div className="font-semibold text-base text-gray-600 dark:text-gray-400">
                                            {(members || []).length}
                                        </div>
                                        <div className="mt-4 font-medium text-base text-gray-400 dark:text-gray-600">
                                            Next invoice on
                                        </div>
                                        <div className="font-semibold text-base text-gray-600 dark:text-gray-400">
                                            {guessNextInvoiceDate(teamSubscription.startDate).toDateString()}
                                        </div>
                                        <div className="flex-grow flex flex-col items-stretch justify-end">
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
                <div className="mt-4 text-gray-500">
                    Gitpod automatically adds all members of this organization to the plan.{" "}
                    <a href="https://www.gitpod.io/docs/team-billing" rel="noopener" className="gp-link">
                        Learn more
                    </a>
                </div>
            </>
        );
    }

    const showUBP = BillingMode.showUsageBasedBilling(teamBillingMode);

    return showUBP ? <TeamUsageBasedBilling /> : renderTeamBilling();
};

function guessNextInvoiceDate(startDate: string): Date {
    const now = new Date();
    const date = new Date(startDate);
    while (date < now) {
        date.setMonth(date.getMonth() + 1);
    }
    return date;
}
