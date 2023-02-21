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

const KEY_PERSONAL_SUB = "personalSubscription";
const KEY_TEAM1_SUB = "teamSubscription";
const KEY_TEAM2_SUB = "teamSubscription2";

type SubscriptionType = typeof KEY_PERSONAL_SUB | typeof KEY_TEAM1_SUB | typeof KEY_TEAM2_SUB;
type Params = { id: string; type: SubscriptionType };

function SwitchToPAYG() {
    const { switchToPAYG } = useContext(FeatureFlagContext);
    const user = useCurrentUser();
    const location = useLocation();
    const params = parseSearchParams(location.search);

    const [errorMessage, setErrorMessage] = useState<string | undefined>();
    const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | undefined>();
    const [showBillingSetupModal, setShowBillingSetupModal] = useState<boolean>(false);
    const [attributionId, setAttributionId] = useState<string>("");
    const [pendingStripeSubscription, setPendingStripeSubscription] = useState<boolean>(false);

    useEffect(() => {
        if (!attributionId) {
            return;
        }
        const params = new URLSearchParams(location.search);
        if (!params.get("setup_intent") || params.get("redirect_status") !== "succeeded") {
            return;
        }
        const setupIntentId = params.get("setup_intent")!;
        window.history.replaceState({}, "", location.pathname);
        (async () => {
            try {
                setPendingStripeSubscription(true);
                const limit = 1000;
                await getGitpodService().server.subscribeToStripe(attributionId, setupIntentId, limit);
            } catch (error) {
                console.error("Could not subscribe to Stripe", error);
                setPendingStripeSubscription(false);
                setErrorMessage(`Could not subscribe to Stripe. ${error?.message || String(error)}`);
                return;
            }

            // unfortunately, we need to poll for the subscription
            const interval = setInterval(async () => {
                try {
                    const subscriptionId = await getGitpodService().server.findStripeSubscriptionId(attributionId);
                    setStripeSubscriptionId(subscriptionId);
                    clearInterval(interval);
                    setPendingStripeSubscription(false);
                    return subscriptionId;
                } catch (error) {
                    console.error("Could not find a subscription to be created", error);
                }
            }, 1000);
        })();
    }, [attributionId, location.pathname, location.search]);

    const onUpgradePlan = useCallback(() => {
        setShowBillingSetupModal(true);

        // TODO(at) select/create Org based on `params.type` and convert to AttributionId
        // for now always create new dummy Org
        (async () => {
            const response = await teamsService.createTeam({ name: `${user?.name || "Unknown"}'s Org` });
            const teamId = response.team?.id;
            if (!teamId) {
                return;
            }
            setAttributionId(AttributionId.render({ kind: "team", teamId }));
        })();
    }, [user]);

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
                <div className="text-gray-500 text-center text-base">Pay-as-you-go has several clear benefits. ...</div>
                <div className="text-gray-500 text-center text-base">How do you get started?</div>
                <div className="-mx-6 px-6 mt-6 w-full">{JSON.stringify(params)}</div>
                {errorMessage && (
                    <Alert className="max-w-xl mt-2" closable={false} showIcon={true} type="error">
                        {errorMessage}
                    </Alert>
                )}
                {pendingStripeSubscription && (
                    <div className="flex flex-col mt-4 h-52 p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                        <div className="uppercase text-sm text-gray-400 dark:text-gray-500">Balance</div>
                        <SpinnerLoader small={false} />
                    </div>
                )}
                {stripeSubscriptionId && (
                    <Alert className="max-w-xl mt-2" closable={false} showIcon={true} type="success">
                        {stripeSubscriptionId} 🎉
                    </Alert>
                )}
                <div className="w-full flex justify-end mt-6 space-x-2 px-6">
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

function parseSearchParams(search: string): Params | undefined {
    const params = new URLSearchParams(search);
    for (const key of [KEY_TEAM1_SUB, KEY_TEAM2_SUB, KEY_PERSONAL_SUB]) {
        let id = params.get(key);
        if (id) {
            return {
                type: key as any,
                id,
            };
        }
    }
}

export default SwitchToPAYG;
