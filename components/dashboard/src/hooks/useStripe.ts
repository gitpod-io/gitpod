/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useEffect, useState } from "react";
import { getGitpodService } from "../service/service";
import { useLocation } from "react-router";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";

interface hasId {
    id: string;
}

type PendingStripeSubscription = { pendingSince: number };

type returnType = [
    boolean,
    string | undefined,
    boolean,
    boolean,
    string | undefined,
    number | undefined,
    (newLimit: number) => Promise<void>,
];

const useStripe = (subject: hasId | undefined, attributionId: AttributionId, localStorageKey: string): returnType => {
    const location = useLocation();
    const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | undefined>();
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [stripePortalUrl, setStripePortalUrl] = useState<string | undefined>();
    const [pollStripeSubscriptionTimeout, setPollStripeSubscriptionTimeout] = useState<NodeJS.Timeout | undefined>();
    const [usageLimit, setUsageLimit] = useState<number | undefined>();
    const [pendingStripeSubscription, setPendingStripeSubscription] = useState<PendingStripeSubscription | undefined>();
    const [billingError, setBillingError] = useState<string | undefined>();

    useEffect(() => {
        if (!subject) {
            return;
        }
        (async () => {
            setStripeSubscriptionId(undefined);
            setIsLoading(true);
            try {
                const subscriptionId = await getGitpodService().server.findStripeSubscriptionId(
                    AttributionId.render(attributionId),
                );
                setStripeSubscriptionId(subscriptionId);
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        })();
    }, [subject]);

    useEffect(() => {
        if (!subject || !stripeSubscriptionId) {
            return;
        }
        (async () => {
            const [portalUrl, spendingLimit] = await Promise.all([
                getGitpodService().server.getStripePortalUrl(AttributionId.render(attributionId)),
                getGitpodService().server.getUsageLimit(AttributionId.render(attributionId)),
            ]);
            setStripePortalUrl(portalUrl);
            setUsageLimit(spendingLimit);
        })();
    }, [subject, stripeSubscriptionId]);

    useEffect(() => {
        if (!subject) {
            return;
        }
        const params = new URLSearchParams(location.search);
        if (!params.get("setup_intent") || params.get("redirect_status") !== "succeeded") {
            return;
        }
        (async () => {
            const setupIntentId = params.get("setup_intent")!;
            window.history.replaceState({}, "", location.pathname);
            const pendingSubscription = { pendingSince: Date.now() };
            setPendingStripeSubscription(pendingSubscription);
            window.localStorage.setItem(localStorageKey, JSON.stringify(pendingSubscription));
            try {
                await getGitpodService().server.subscribeToStripe(AttributionId.render(attributionId), setupIntentId);
            } catch (error) {
                console.error("Could not subscribe subject to Stripe", error);
                window.localStorage.removeItem(localStorageKey);
                clearTimeout(pollStripeSubscriptionTimeout!);
                setPendingStripeSubscription(undefined);
                setBillingError(`Could not subscribe subject to Stripe. ${error?.message || String(error)}`);
            }
        })();
    }, [location.search, subject]);

    useEffect(() => {
        setPendingStripeSubscription(undefined);
        if (!subject) {
            return;
        }
        try {
            const pendingStripeSubscription = window.localStorage.getItem(localStorageKey);
            if (!pendingStripeSubscription) {
                return;
            }
            const pending = JSON.parse(pendingStripeSubscription);
            setPendingStripeSubscription(pending);
        } catch (error) {
            console.error("Could not load pending stripe subscription", subject.id, error);
        }
    }, [subject]);

    useEffect(() => {
        if (!pendingStripeSubscription || !subject) {
            return;
        }
        if (!!stripeSubscriptionId) {
            // The upgrade was successful!
            window.localStorage.removeItem(localStorageKey);
            clearTimeout(pollStripeSubscriptionTimeout!);
            setPendingStripeSubscription(undefined);
            return;
        }
        if (pendingStripeSubscription.pendingSince + 1000 * 60 * 5 < Date.now()) {
            // Pending Stripe subscription expires after 5 minutes
            window.localStorage.removeItem(localStorageKey);
            clearTimeout(pollStripeSubscriptionTimeout!);
            setPendingStripeSubscription(undefined);
            return;
        }
        if (!pollStripeSubscriptionTimeout) {
            // Refresh Stripe subscription in 5 seconds in order to poll for upgrade confirmation
            const timeout = setTimeout(async () => {
                const subscriptionId = await getGitpodService().server.findStripeSubscriptionId(
                    AttributionId.render(attributionId),
                );
                setStripeSubscriptionId(subscriptionId);
                setPollStripeSubscriptionTimeout(undefined);
            }, 5000);
            setPollStripeSubscriptionTimeout(timeout);
        }
    }, [pendingStripeSubscription, pollStripeSubscriptionTimeout, stripeSubscriptionId, subject]);

    const showSpinner = isLoading || !!pendingStripeSubscription;
    const showUpgradeBilling = !showSpinner && !stripeSubscriptionId;
    const showManageBilling = !showSpinner && !!stripeSubscriptionId;

    const doUpdateLimit = async (newLimit: number) => {
        if (!subject) {
            return;
        }
        const oldLimit = usageLimit;
        setUsageLimit(newLimit);
        try {
            await getGitpodService().server.setUsageLimit(AttributionId.render(attributionId), newLimit);
        } catch (error) {
            setUsageLimit(oldLimit);
            console.error(error);
            alert(error?.message || "Failed to update usage limit. See console for error message.");
        }
    };

    return [
        showSpinner,
        billingError,
        showUpgradeBilling,
        showManageBilling,
        stripePortalUrl,
        usageLimit,
        doUpdateLimit,
    ];
};

export default useStripe;
