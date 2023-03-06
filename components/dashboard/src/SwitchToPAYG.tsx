/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useContext, useEffect, useState } from "react";
import { Redirect, useLocation } from "react-router";
import { useCurrentUser } from "./user-context";
import { FeatureFlagContext } from "./contexts/FeatureFlagContext";
import { BillingSetupModal } from "./components/UsageBasedBillingConfig";
import { SpinnerLoader } from "./components/Loader";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { getGitpodService } from "./service/service";
import Alert from "./components/Alert";
import { useLocalStorage } from "./hooks/use-local-storage";
import { Subscription } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { TeamSubscription, TeamSubscription2 } from "@gitpod/gitpod-protocol/lib/team-subscription-protocol";
import { useConfetti } from "./contexts/ConfettiContext";
import { resetAllNotifications } from "./AppNotifications";
import { Plans } from "@gitpod/gitpod-protocol/lib/plans";
import ContextMenu, { ContextMenuEntry } from "./components/ContextMenu";
import CaretDown from "./icons/CaretDown.svg";
import { TeamsContext, useCurrentTeam } from "./teams/teams-context";
import { Team } from "@gitpod/gitpod-protocol";
import { OrgEntry } from "./menu/OrganizationSelector";

/**
 * Keys of known page params
 */
const KEY_PERSONAL_SUB = "personalSubscription";
const KEY_TEAM1_SUB = "teamSubscription";
const KEY_TEAM2_SUB = "teamSubscription2";
//
const KEY_STRIPE_SETUP_INTENT = "setup_intent";
// const KEY_STRIPE_IGNORED = "setup_intent_client_secret";
const KEY_STRIPE_REDIRECT_STATUS = "redirect_status";

type SubscriptionType = typeof KEY_PERSONAL_SUB | typeof KEY_TEAM1_SUB | typeof KEY_TEAM2_SUB;
type PageParams = {
    oldSubscriptionOrTeamId: string;
    type: SubscriptionType;
    setupIntentId?: string;
};
type PageState = {
    phase: "call-to-action" | "trigger-signup" | "wait-for-signup" | "cleanup" | "done";
    attributionId?: string;
    setupIntentId?: string;
    old?: {
        planName: string;
        planDetails: string;
        subscriptionId: string;
    };
};

function SwitchToPAYG() {
    const { switchToPAYG } = useContext(FeatureFlagContext);
    const user = useCurrentUser();
    const location = useLocation();
    const pageParams = parseSearchParams(location.search);
    const [pageState, setPageState] = useLocalStorage<PageState>(getLocalStorageKey(pageParams), {
        phase: "call-to-action",
    });

    const currentOrg = useCurrentTeam();
    const { teams } = useContext(TeamsContext);
    const [errorMessage, setErrorMessage] = useState<string | undefined>();
    const [selectedOrganization, setSelectedOrganization] = useState<Team | undefined>(undefined);
    const [showBillingSetupModal, setShowBillingSetupModal] = useState<boolean>(false);
    const [pendingStripeSubscription, setPendingStripeSubscription] = useState<boolean>(false);
    const [droppedConfetti, setDroppedConfetti] = useState<boolean>(false);
    const { dropConfetti } = useConfetti();

    useEffect(() => {
        setSelectedOrganization(currentOrg);
    }, [currentOrg, setSelectedOrganization]);

    useEffect(() => {
        const { phase, attributionId, setupIntentId } = pageState;
        if (phase !== "trigger-signup") {
            return;
        }
        console.log("phase: " + phase);

        // We're back from the Stripe modal: (safely) trigger the signup
        if (!attributionId) {
            console.error("Signup, but attributionId not set!");
            return;
        }
        if (!setupIntentId) {
            console.error("Signup, but setupIntentId not set!");
            setPageState((s) => ({ ...s, phase: "call-to-action" }));
            return;
        }

        let cancelled = false;
        (async () => {
            // At this point we're coming back from the Stripe modal, and have the intent to setup a new subscription.
            // Technically, we have to guard against:
            //  - reloads
            //  - unmounts (for whatever reason)

            // Do we already have a subscription (co-owner, me in another tab, reload, etc.)?
            let subscriptionId = await getGitpodService().server.findStripeSubscriptionId(attributionId);
            if (subscriptionId) {
                console.log(`${attributionId} already has a subscription! Moving to cleanup`);
                // We're happy!
                if (!cancelled) {
                    setPageState((s) => ({ ...s, phase: "cleanup" }));
                }
                return;
            }

            // Now we want to signup for sure
            setPendingStripeSubscription(true);
            try {
                if (cancelled) return;

                const limit = 1000;
                console.log("SUBSCRIBE TO STRIPE");
                await getGitpodService().server.subscribeToStripe(attributionId, setupIntentId, limit);
                // Here we go off the effect handler due to the await
                if (!cancelled) {
                    setPageState((s) => ({ ...s, phase: "wait-for-signup" }));
                }
            } catch (error) {
                if (cancelled) return;

                setErrorMessage(`Could not subscribe to Stripe. ${error?.message || String(error)}`);
                setPendingStripeSubscription(false);
                return;
            }
        })().catch(console.error);

        return () => {
            cancelled = true;
        };
    }, [pageState, setPageState]);

    useEffect(() => {
        const { phase, attributionId, old } = pageState;
        const { setupIntentId, type, oldSubscriptionOrTeamId } = pageParams || {};
        if (phase === "trigger-signup") {
            // Handled in separate effect
            return;
        }

        if (!type) {
            setErrorMessage("Error during params parsing: type not set!");
            return;
        }
        if (!oldSubscriptionOrTeamId) {
            setErrorMessage("Error during params parsing: oldSubscriptionOrTeamId not set!");
            return;
        }

        console.log("phase: " + phase);
        switch (phase) {
            case "call-to-action": {
                // Check: Can we progress?
                if (setupIntentId) {
                    setPageState((s) => ({ ...s, setupIntentId, phase: "trigger-signup" }));
                    return;
                }

                // Just verify and display information
                let cancelled = false;
                (async () => {
                    // Old Subscription still active?
                    let derivedAttributionId: string | undefined = undefined;
                    let old: PageState["old"];
                    switch (type) {
                        case "personalSubscription": {
                            const oldSubscriptionId = oldSubscriptionOrTeamId;
                            const statement = await getGitpodService().server.getAccountStatement({});
                            if (!statement) {
                                console.error("No AccountStatement!");
                                break;
                            }
                            const sub = statement.subscriptions.find((s) => s.uid === oldSubscriptionId);
                            if (!sub) {
                                console.error(`No personal subscription ${oldSubscriptionId}!`);
                                break;
                            }
                            const now = new Date().toISOString();
                            if (Subscription.isCancelled(sub, now) || !Subscription.isActive(sub, now)) {
                                // We're happy!
                                if (!cancelled) {
                                    setPageState((s) => ({ ...s, phase: "done" }));
                                }
                                return;
                            }
                            old = {
                                subscriptionId: sub.uid,
                                planName: Plans.getById(sub.planId!)!.name,
                                planDetails: "personal",
                            };
                            derivedAttributionId = AttributionId.render({ kind: "user", userId: sub.userId });
                            break;
                        }

                        case "teamSubscription": {
                            const oldSubscriptionId = oldSubscriptionOrTeamId;
                            const tss = await getGitpodService().server.tsGet();
                            const ts = tss.find((s) => s.id === oldSubscriptionId);
                            if (!ts) {
                                console.error(`No TeamSubscription ${oldSubscriptionId}!`);
                                break;
                            }
                            const now = new Date().toISOString();
                            if (TeamSubscription.isCancelled(ts, now) || !TeamSubscription.isActive(ts, now)) {
                                // We're happy!
                                if (!cancelled) {
                                    setPageState((s) => ({ ...s, phase: "done" }));
                                }
                                return;
                            }
                            old = {
                                subscriptionId: ts.id,
                                planName: Plans.getById(ts.planId!)!.name,
                                planDetails: `${ts.quantity} Members`,
                            };
                            // User has to select/create new org
                            if (selectedOrganization) {
                                derivedAttributionId = AttributionId.render({
                                    kind: "team",
                                    teamId: selectedOrganization.id,
                                });
                            }
                            break;
                        }

                        case "teamSubscription2": {
                            const teamId = oldSubscriptionOrTeamId;
                            const ts2 = await getGitpodService().server.getTeamSubscription(teamId);
                            if (!ts2) {
                                console.error(`No TeamSubscription2 for team ${teamId}!`);
                                break;
                            }
                            const now = new Date().toISOString();
                            if (TeamSubscription2.isCancelled(ts2, now) || !TeamSubscription2.isActive(ts2, now)) {
                                // We're happy!
                                if (!cancelled) {
                                    setPageState((s) => ({ ...s, phase: "done" }));
                                }
                                return;
                            }
                            old = {
                                subscriptionId: ts2.id,
                                planName: Plans.getById(ts2.planId!)!.name,
                                planDetails: `${ts2.quantity} Members`,
                            };
                            derivedAttributionId = AttributionId.render({ kind: "team", teamId });
                            break;
                        }
                    }
                    if (!cancelled && !attributionId) {
                        setPageState((s) => {
                            const attributionId = s.attributionId || derivedAttributionId;
                            return { ...s, attributionId, old };
                        });
                    }
                })().catch(console.error);

                return () => {
                    cancelled = true;
                };
            }

            case "wait-for-signup": {
                // Wait for the singup to be completed
                if (!attributionId) {
                    console.error("Signup, but attributionId not set!");
                    return;
                }
                setPendingStripeSubscription(true);

                let cancelled = false;
                (async () => {
                    // We need to poll for the subscription to appear
                    let subscriptionId: string | undefined;
                    for (let i = 1; i <= 10; i++) {
                        if (cancelled) {
                            break;
                        }

                        try {
                            subscriptionId = await getGitpodService().server.findStripeSubscriptionId(attributionId);
                            if (subscriptionId) {
                                break;
                            }
                        } catch (error) {
                            console.error("Search for subscription failed.", error);
                        }
                        await new Promise((resolve) => setTimeout(resolve, 1000));
                    }
                    if (cancelled) {
                        return;
                    }

                    setPendingStripeSubscription(false);
                    if (!subscriptionId) {
                        setErrorMessage(`Could not find the subscription.`);
                        return;
                    }
                    setPageState((s) => ({ ...s, phase: "cleanup" }));
                })().catch(console.error);

                return () => {
                    cancelled = true;
                };
            }

            case "cleanup": {
                const oldSubscriptionId = old?.subscriptionId;
                if (!oldSubscriptionId) {
                    setErrorMessage("Error during cleanup: old.oldSubscriptionId not set!");
                    return;
                }

                switch (type) {
                    case "personalSubscription":
                        getGitpodService()
                            .server.subscriptionCancel(oldSubscriptionId)
                            .catch((error) => {
                                console.error(
                                    "Failed to cancel old subscription. We should take care of that async.",
                                    error,
                                );
                            });
                        break;

                    case "teamSubscription":
                        const attrId = AttributionId.parse(attributionId || "");
                        if (attrId?.kind === "team") {
                            // This should always be the case
                            getGitpodService()
                                .server.tsAddMembersToOrg(oldSubscriptionId, attrId.teamId)
                                .catch((error) => {
                                    console.error("Failed to move members to new org.", error);
                                });
                        }

                        getGitpodService()
                            .server.tsCancel(oldSubscriptionId)
                            .catch((error) => {
                                console.error(
                                    "Failed to cancel old subscription. We should take care of that async.",
                                    error,
                                );
                            });
                        break;

                    case "teamSubscription2":
                        getGitpodService()
                            .server.cancelTeamSubscription(oldSubscriptionId)
                            .catch((error) => {
                                console.error(
                                    "Failed to cancel old subscription. We should take care of that async.",
                                    error,
                                );
                            });
                        break;
                }
                setPageState((s) => ({ ...s, phase: "done" }));
                return;
            }

            case "done":
                // Hooray and confetti!
                resetAllNotifications();
                if (!droppedConfetti) {
                    setDroppedConfetti(true);
                    dropConfetti();
                }
                return;
        }
    }, [
        location.search,
        pageParams,
        pageState,
        setPageState,
        pendingStripeSubscription,
        setPendingStripeSubscription,
        selectedOrganization,
        dropConfetti,
        droppedConfetti,
    ]);

    const onUpgradePlan = useCallback(async () => {
        if (pageState.phase !== "call-to-action" || !pageState.attributionId) {
            return;
        }

        setShowBillingSetupModal(true);
    }, [pageState.phase, pageState.attributionId]);

    if (!switchToPAYG || !user || !pageParams) {
        return (
            <Redirect
                to={{
                    pathname: "/workspaces",
                    state: { from: location },
                }}
            />
        );
    }

    if (pageState.phase === "done") {
        return (
            <div className="flex flex-col max-h-screen max-w-2xl mx-auto items-center w-full">
                <Alert className="w-full mt-2" closable={false} showIcon={true} type="success">
                    Thanks for renewing your subscription 🎉
                </Alert>
            </div>
        );
    }

    let titleModifier = "";
    if (pageParams?.type === "personalSubscription") {
        titleModifier = "personal plan";
    } else if (pageParams?.type === "teamSubscription") {
        titleModifier = "team plan";
    } else if (pageParams?.type === "teamSubscription2") {
        titleModifier = "organization's plan";
    }

    const planName = pageState.old?.planName || "Legacy Plan";
    const planDescription = pageState.old?.planDetails || "";
    const selectorEntries = getOrganizationSelectorEntries(teams || [], setSelectedOrganization);
    return (
        <div className="flex flex-col max-h-screen max-w-3xl mx-auto items-center w-full mt-24">
            <h1>{`Update your ${titleModifier}`}</h1>
            <div className="w-full text-gray-500 text-center">
                Switch to the new pricing model to keep uninterrupted access and get <strong>large workspaces</strong>{" "}
                and <strong>custom timeouts</strong>.{" "}
                <a
                    className="gp-link"
                    href="https://www.gitpod.io/blog/introducing-workspace-classes-and-flexible-pricing"
                >
                    Learn more →
                </a>
            </div>
            <div className="mt-6 space-x-3 flex">
                {renderCard({
                    headline: "LEGACY PLAN",
                    title: planName,
                    description: planDescription,
                    selected: false,
                    action: (
                        <Alert type="error">
                            Discontinued on <strong>March 31st</strong>
                        </Alert>
                    ),
                    additionalStyles: "",
                })}
                {renderCard({
                    headline: "NEW PLAN",
                    title: "$9 / month (1,000 credits)",
                    description: "Pay-as-you-go after that for $0.036 per credit.",
                    selected: true,
                    action: (
                        <a className="gp-link" href="https://www.gitpod.io/pricing#cost-estimator">
                            Estimate costs
                        </a>
                    ),
                    additionalStyles: "",
                })}
            </div>
            <div className="w-full grid justify-items-center">
                <div className="w-96 mt-8 text-center">
                    {pageParams?.type === "teamSubscription" && (
                        <div className="w-full">
                            <p className="text-gray-500 text-center text-base">
                                Select organization or{" "}
                                <a className="gp-link" target="_blank" href="/orgs/new">
                                    create a new one
                                </a>
                            </p>
                            <div className="mt-2 flex-col w-full">
                                <div className="px-8 flex flex-col space-y-2">
                                    <ContextMenu
                                        customClasses="w-full left-0 cursor-pointer"
                                        menuEntries={selectorEntries}
                                    >
                                        <div>
                                            {selectedOrganization ? (
                                                <OrgEntry
                                                    id={selectedOrganization.id}
                                                    title={selectedOrganization.name}
                                                    subtitle=""
                                                    iconSize="small"
                                                />
                                            ) : (
                                                <input
                                                    className="w-full px-12 cursor-pointer font-semibold"
                                                    readOnly
                                                    type="text"
                                                    value={selectedOrganization}
                                                ></input>
                                            )}
                                            <img
                                                src={CaretDown}
                                                title="Select Account"
                                                className="filter-grayscale absolute top-1/2 right-3"
                                                alt="down caret icon"
                                            />
                                        </div>
                                    </ContextMenu>
                                </div>
                            </div>
                            <div className="mt-2 text-sm text-gray-500 w-full text-center">
                                Legacy Team Subscription <strong>members</strong> will be moved to the selected
                                organization, and the new plan will cover all organization usage.
                            </div>
                        </div>
                    )}
                </div>
                <div className="w-96 mt-8 text-center">
                    {pendingStripeSubscription && (
                        <div className="w-full text-center mb-2">
                            <SpinnerLoader small={true} content="Creating subscription with Stripe" />
                        </div>
                    )}
                    <button
                        className="w-full"
                        onClick={onUpgradePlan}
                        disabled={pageState.phase !== "call-to-action" || !pageState.attributionId}
                    >
                        Switch to pay-as-you-go
                    </button>
                    <div className="mt-2 text-sm text-gray-500 w-full text-center">
                        Remaining legacy subscription time will be refunded.
                    </div>
                </div>
                {errorMessage && (
                    <Alert className="w-full mt-10" closable={false} showIcon={true} type="error">
                        {errorMessage}
                    </Alert>
                )}
            </div>
            {showBillingSetupModal &&
                (pageState.attributionId ? (
                    <BillingSetupModal
                        attributionId={pageState.attributionId}
                        onClose={() => setShowBillingSetupModal(false)}
                    />
                ) : (
                    <SpinnerLoader small={true} />
                ))}
        </div>
    );
}

function getOrganizationSelectorEntries(organizations: Team[], setSelectedOrganization: (org: Team) => void) {
    const result: ContextMenuEntry[] = [];
    for (const org of organizations) {
        result.push({
            title: org.name,
            customContent: <OrgEntry id={org.id} title={org.name} subtitle="" iconSize="small" />,
            onClick: () => setSelectedOrganization(org),
        });
    }
    return result;
}

function renderCard(props: {
    headline: string;
    title: string;
    description: string;
    action: JSX.Element;
    selected: boolean;
    additionalStyles?: string;
}) {
    return (
        <div
            className={`rounded-xl px-3 py-3 flex flex-col cursor-pointer group transition ease-in-out ${
                props.selected ? "bg-gray-800 dark:bg-gray-100" : "bg-gray-100 dark:bg-gray-800"
            } ${props.additionalStyles || ""}`}
        >
            <div className="flex items-center">
                <p
                    className={`w-full pl-1 text-sm font-normal truncate ${
                        props.selected ? "text-gray-400 dark:text-gray-400" : "text-gray-400 dark:text-gray-500"
                    }`}
                    title={props.headline}
                >
                    {props.headline}
                </p>
                <input className="opacity-0" type="radio" checked={props.selected} />
            </div>
            <div className="pl-1 grid auto-rows-auto">
                <div
                    className={`text-xl font-semibold mt-1 mb-4 ${
                        props.selected ? "text-gray-100 dark:text-gray-600" : "text-gray-700 dark:text-gray-300"
                    }`}
                >
                    {props.title}
                </div>
                <div
                    className={`text-sm font-normal truncate w-full ${
                        props.selected ? "text-gray-300 dark:text-gray-500" : "text-gray-500 dark:text-gray-400"
                    }`}
                >
                    {props.description}
                </div>
                <div className="text-xl my-1 flex-row flex align-middle items-end">
                    <div
                        className={`text-sm font-normal truncate w-full ${
                            props.selected ? "text-gray-300 dark:text-gray-500" : "text-gray-500 dark:text-gray-400"
                        }`}
                    >
                        {props.action}
                    </div>
                </div>
            </div>
        </div>
    );
}

function getLocalStorageKey(p: PageParams | undefined) {
    if (!p) {
        return "switch-to-paygo-broken-key";
    }
    return `switch-to-paygo--old-sub-${p.oldSubscriptionOrTeamId}`;
}

function parseSearchParams(search: string): PageParams | undefined {
    const params = new URLSearchParams(search);
    const setupIntentId =
        (params.get(KEY_STRIPE_REDIRECT_STATUS) === "succeeded" ? params.get(KEY_STRIPE_SETUP_INTENT) : undefined) ||
        undefined;
    for (const key of [KEY_TEAM1_SUB, KEY_TEAM2_SUB, KEY_PERSONAL_SUB]) {
        let id = params.get(key);
        if (id) {
            return {
                type: key as any,
                oldSubscriptionOrTeamId: id,
                setupIntentId,
            };
        }
    }
}

export default SwitchToPAYG;
