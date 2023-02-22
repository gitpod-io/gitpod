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

/**
 * Keys of known page params
 */
const KEY_PERSONAL_SUB = "personalSubscription";
const KEY_TEAM1_SUB = "teamSubscription";
const KEY_TEAM2_SUB = "teamSubscription2";
const KEY_ATTRIBUTION_ID = "attributionId";
//
const KEY_STRIPE_SETUP_INTENT = "setup_intent";
const KEY_STRIPE_IGNORED = "setup_intent_client_secret";
const KEY_STRIPE_REDIRECT_STATUS = "redirect_status";

type SubscriptionType = typeof KEY_PERSONAL_SUB | typeof KEY_TEAM1_SUB | typeof KEY_TEAM2_SUB;
type PageParams = {
    id: string;
    type: SubscriptionType;
    attributionId?: string;
};

function SwitchToPAYG() {
    const { switchToPAYG } = useContext(FeatureFlagContext);
    const user = useCurrentUser();
    const location = useLocation();
    const params = parseSearchParams(location.search);

    const [errorMessage, setErrorMessage] = useState<string | undefined>();
    const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | undefined>();
    const [showBillingSetupModal, setShowBillingSetupModal] = useState<boolean>(false);
    const [attributionId, setAttributionId] = useState(params?.attributionId);
    const [pendingStripeSubscription, setPendingStripeSubscription] = useState<boolean>(false);

    useEffect(() => {
        if (!attributionId) {
            return;
        }
        const params = new URLSearchParams(location.search);
        if (!params.get(KEY_STRIPE_SETUP_INTENT) || params.get(KEY_STRIPE_REDIRECT_STATUS) !== "succeeded") {
            return;
        }
        const setupIntentId = params.get(KEY_STRIPE_SETUP_INTENT)!;

        // remove
        [KEY_STRIPE_SETUP_INTENT, KEY_STRIPE_REDIRECT_STATUS, KEY_STRIPE_IGNORED].forEach((p) => params.delete(p));
        window.history.replaceState({}, "", `${location.pathname}?${params.toString()}`);

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
            for (let i = 1; i <= 10; i++) {
                try {
                    const subscriptionId = await getGitpodService().server.findStripeSubscriptionId(attributionId);
                    setStripeSubscriptionId(subscriptionId);
                    setPendingStripeSubscription(false);
                } catch (error) {
                    console.error("Could not find a subscription to be created", error);
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            setErrorMessage(`Could not find the subscription.`);
        })();
    }, [attributionId, location.pathname, location.search]);

    const onUpgradePlan = useCallback(async () => {
        if (!user || !params?.type) {
            return;
        }
        setShowBillingSetupModal(true);

        let attributionId: string;
        if (params.type === "personalSubscription") {
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
        setAttributionId(attributionId);

        // HINT: the `attributionId` needs to be preserved for the follow-up step of the subscription process
        const newURL = new URL(window.location.href);
        newURL.searchParams.set(KEY_ATTRIBUTION_ID, attributionId);
        window.history.pushState({ path: newURL.toString() }, "", newURL.toString());
    }, [params?.type, user]);

    if (!switchToPAYG || !user || !params) {
        return (
            <Redirect
                to={{
                    pathname: "/workspaces",
                    state: { from: location },
                }}
            />
        );
    }

    return (
        <div className="flex flex-col mt-32 mx-auto ">
            <div className="flex flex-col max-h-screen max-w-2xl mx-auto items-center w-full">
                <h1>Switch to Pay-as-you-go</h1>
                <div className="mt-6 text-gray-500 text-center text-base">
                    Pay-as-you-go has several clear benefits ...
                </div>
                <div className="mt-6 w-full">{params.type}</div>
                {errorMessage && (
                    <Alert className="max-w-xl mt-2" closable={false} showIcon={true} type="error">
                        {errorMessage}
                    </Alert>
                )}
                {pendingStripeSubscription && (
                    <div className="flex flex-col mt-4 h-52 p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                        <SpinnerLoader small={false} />
                    </div>
                )}
                {stripeSubscriptionId && (
                    <Alert className="max-w-xl mt-2" closable={false} showIcon={true} type="success">
                        {stripeSubscriptionId} 🎉
                    </Alert>
                )}
                <div className="w-full flex justify-center mt-6 space-x-2 px-6">
                    <button onClick={onUpgradePlan} disabled={showBillingSetupModal}>
                        Upgrade Plan
                    </button>
                </div>
                {showBillingSetupModal &&
                    (attributionId ? (
                        <BillingSetupModal
                            attributionId={attributionId}
                            onClose={() => setShowBillingSetupModal(false)}
                        />
                    ) : (
                        <SpinnerLoader small={true} />
                    ))}
                <div></div>
            </div>
        </div>
    );
}

function parseSearchParams(search: string): PageParams | undefined {
    const params = new URLSearchParams(search);
    for (const key of [KEY_TEAM1_SUB, KEY_TEAM2_SUB, KEY_PERSONAL_SUB]) {
        let id = params.get(key);
        if (id) {
            return {
                type: key as any,
                id,
                attributionId: params.get(KEY_ATTRIBUTION_ID) || undefined,
            };
        }
    }
}

export default SwitchToPAYG;
