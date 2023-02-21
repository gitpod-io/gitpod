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
import { teamsService } from "./service/public-api";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { getGitpodService } from "./service/service";
import Alert from "./components/Alert";
import { useLocalStorage } from "./hooks/use-local-storage";

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
    oldSubscriptionId: string;
    type: SubscriptionType;
    setupIntentId?: string;
};
type PageState = {
    attributionId?: string;
    result?: string;
};

function SwitchToPAYG() {
    const { switchToPAYG } = useContext(FeatureFlagContext);
    const user = useCurrentUser();
    const location = useLocation();
    const pageParams = parseSearchParams(location.search);
    const [pageState, setPageState] = useLocalStorage<PageState>(getLocalStorageKey(pageParams), {});

    const [errorMessage, setErrorMessage] = useState<string | undefined>();
    // const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | undefined>();
    const [showBillingSetupModal, setShowBillingSetupModal] = useState<boolean>(false);
    const [pendingStripeSubscription, setPendingStripeSubscription] = useState<boolean>(false);

    useEffect(() => {
        const { attributionId } = pageState;
        const oldSubscriptionId = pageParams?.oldSubscriptionId;
        const setupIntentId = pageParams?.setupIntentId;
        if (!attributionId || !setupIntentId || !oldSubscriptionId) {
            return;
        }

        // remove
        // deleteSearchParams([KEY_STRIPE_SETUP_INTENT, KEY_STRIPE_REDIRECT_STATUS, KEY_STRIPE_IGNORED]);

        (async () => {
            setPendingStripeSubscription(true);
            try {
                const limit = 1000;
                await getGitpodService().server.subscribeToStripe(attributionId, setupIntentId, limit);
            } catch (error) {
                setErrorMessage(`Could not subscribe to Stripe. ${error?.message || String(error)}`);
                setPendingStripeSubscription(false);
                return;
            }

            // unfortunately, we need to poll for the subscription
            let subscriptionId: string | undefined;
            for (let i = 1; i <= 10; i++) {
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
            setPendingStripeSubscription(false);
            if (subscriptionId) {
                // setStripeSubscriptionId(subscriptionId);
                cancelOldSubscription(pageParams.type, oldSubscriptionId);

                setPageState((s) => ({ ...s, result: "done" }));
            } else {
                setErrorMessage(`Could not find the subscription.`);
            }
        })();
    }, [
        location.search,
        pageParams?.oldSubscriptionId,
        pageParams?.setupIntentId,
        pageParams?.type,
        pageState,
        setPageState,
    ]);

    const onUpgradePlan = useCallback(async () => {
        if (!user || !pageParams?.type || pageState.result) {
            return;
        }
        setShowBillingSetupModal(true);

        let attributionId: string;
        if (pageParams.type === KEY_PERSONAL_SUB) {
            attributionId = AttributionId.render({ kind: "user", userId: user.id });
        } else {
            // TODO(at) orgs should be selectable eventually.
            // for now always create new dummy Org
            const response = await teamsService.createTeam({ name: `${user?.name || "Unknown"}'s Org` });
            const teamId = response.team?.id;
            if (!teamId) {
                return;
            }
            attributionId = AttributionId.render({ kind: "team", teamId });
        }
        setPageState((s) => ({ ...s, attributionId }));
    }, [pageParams?.type, pageState, setPageState, user]);

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

    if (pageState.result === "done") {
        return (
            <div className="flex flex-col max-h-screen max-w-2xl mx-auto items-center w-full">
                <Alert className="w-full mt-2" closable={false} showIcon={true} type="success">
                    Thanks for renewing your subscription 🎉
                </Alert>
            </div>
        );
    }

    return (
        <div className="flex flex-col max-h-screen max-w-2xl mx-auto items-center w-full mt-32">
            <h1>Switch to pay-as-you-go</h1>
            <div className="w-full text-gray-500 text-center">
                Your account still manages one or more obsolete team plans.
            </div>
            <div className="w-96 mt-6 text-sm">
                <Alert className="w-full mt-2" closable={false} showIcon={true} type="warning">
                    Obsolete plans have to switch to the new pay-as-you-go pricing before <strong>Mar 31, 2023</strong>.
                </Alert>
                <div className="w-full h-h96 rounded-xl text-center text-gray-500 bg-gray-50 dark:bg-gray-800"></div>
                <div className="mt-6 w-full text-center">
                    Switch to the new pricing model to access <strong>large workspaces</strong> and{" "}
                    <strong>pay-as-you-go</strong>.{" "}
                    <a className="gp-link" href="https://www.gitpod.io/docs/configure/billing/org-plans">
                        Learn more →
                    </a>
                </div>
                {pendingStripeSubscription && (
                    <div className="w-full mt-6 text-center">
                        <SpinnerLoader small={false} content="Creating subscription with Stripe" />
                    </div>
                )}
                <div className="w-full mt-10 text-center">
                    <button onClick={onUpgradePlan} disabled={showBillingSetupModal || pendingStripeSubscription}>
                        Switch to pay-as-you-go
                    </button>
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

/**
 * We do that in background, so no need to bother with potential error cases.
 */
function cancelOldSubscription(type: SubscriptionType, id: string) {
    if (type === KEY_PERSONAL_SUB) {
        getGitpodService()
            .server.subscriptionCancel(id)
            .catch((error) => {
                console.error("Failed to cancel old subscription. We should take care of that async.", error);
            });
    }
    if (type === KEY_TEAM1_SUB) {
        getGitpodService()
            .server.tsCancel(id)
            .catch((error) => {
                console.error("Failed to cancel old subscription. We should take care of that async.", error);
            });
    }
    if (type === KEY_TEAM2_SUB) {
        console.error("Cancellation of Team Subscription 2 is not implemented. ");
    }
}

function getLocalStorageKey(p: PageParams | undefined) {
    if (!p) {
        return "switch-to-paygo-broken-key";
    }
    return `switch-to-paygo--old-sub-${p.oldSubscriptionId}`;
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
                oldSubscriptionId: id,
                setupIntentId,
            };
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function deleteSearchParams(keys: string[]) {
    const newURL = new URL(window.location.href);
    keys.forEach((key) => newURL.searchParams.delete(key));
    window.history.pushState({ path: newURL.toString() }, "", newURL.toString());
}

export default SwitchToPAYG;
