/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { getCurrentTeam, TeamsContext } from "./teams-context";
import { getGitpodService } from "../service/service";
import UsageBasedBillingConfig from "../components/UsageBasedBillingConfig";
import Alert from "../components/Alert";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";

type PendingStripeSubscription = { pendingSince: number };

export default function TeamUsageBasedBilling() {
    const { teams } = useContext(TeamsContext);
    const location = useLocation();
    const team = getCurrentTeam(location, teams);
    const [teamBillingMode, setTeamBillingMode] = useState<BillingMode | undefined>(undefined);
    const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | undefined>();
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [pendingStripeSubscription, setPendingStripeSubscription] = useState<PendingStripeSubscription | undefined>();
    const [pollStripeSubscriptionTimeout, setPollStripeSubscriptionTimeout] = useState<NodeJS.Timeout | undefined>();
    const [stripePortalUrl, setStripePortalUrl] = useState<string | undefined>();
    const [usageLimit, setUsageLimit] = useState<number | undefined>();
    const [billingError, setBillingError] = useState<string | undefined>();

    useEffect(() => {
        if (!team) {
            return;
        }
        (async () => {
            const teamBillingMode = await getGitpodService().server.getBillingModeForTeam(team.id);
            setTeamBillingMode(teamBillingMode);
        })();
        (async () => {
            setStripeSubscriptionId(undefined);
            setIsLoading(true);
            try {
                const subscriptionId = await getGitpodService().server.findStripeSubscriptionIdForTeam(team.id);
                setStripeSubscriptionId(subscriptionId);
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        })();
    }, [team]);

    useEffect(() => {
        if (!team || !stripeSubscriptionId) {
            return;
        }
        (async () => {
            const [portalUrl, spendingLimit] = await Promise.all([
                getGitpodService().server.getStripePortalUrlForTeam(team.id),
                getGitpodService().server.getUsageLimitForTeam(team.id),
            ]);
            setStripePortalUrl(portalUrl);
            setUsageLimit(spendingLimit);
        })();
    }, [team, stripeSubscriptionId]);

    useEffect(() => {
        if (!team) {
            return;
        }
        const params = new URLSearchParams(location.search);
        if (!params.get("setup_intent") || params.get("redirect_status") !== "succeeded") {
            return;
        }
        (async () => {
            const setupIntentId = params.get("setup_intent")!;
            window.history.replaceState({}, "", window.location.pathname);
            const pendingSubscription = { pendingSince: Date.now() };
            setPendingStripeSubscription(pendingSubscription);
            window.localStorage.setItem(
                `pendingStripeSubscriptionForTeam${team.id}`,
                JSON.stringify(pendingSubscription),
            );
            try {
                await getGitpodService().server.subscribeTeamToStripe(team.id, setupIntentId);
            } catch (error) {
                console.error("Could not subscribe team to Stripe", error);
                window.localStorage.removeItem(`pendingStripeSubscriptionForTeam${team.id}`);
                clearTimeout(pollStripeSubscriptionTimeout!);
                setPendingStripeSubscription(undefined);
                setBillingError(`Could not subscribe team to Stripe. ${error?.message || String(error)}`);
            }
        })();
    }, [location.search, team]);

    useEffect(() => {
        setPendingStripeSubscription(undefined);
        if (!team) {
            return;
        }
        try {
            const pendingStripeSubscription = window.localStorage.getItem(`pendingStripeSubscriptionForTeam${team.id}`);
            if (!pendingStripeSubscription) {
                return;
            }
            const pending = JSON.parse(pendingStripeSubscription);
            setPendingStripeSubscription(pending);
        } catch (error) {
            console.error("Could not load pending stripe subscription", team.id, error);
        }
    }, [team]);

    useEffect(() => {
        if (!pendingStripeSubscription || !team) {
            return;
        }
        if (!!stripeSubscriptionId) {
            // The upgrade was successful!
            window.localStorage.removeItem(`pendingStripeSubscriptionForTeam${team.id}`);
            clearTimeout(pollStripeSubscriptionTimeout!);
            setPendingStripeSubscription(undefined);
            return;
        }
        if (pendingStripeSubscription.pendingSince + 1000 * 60 * 5 < Date.now()) {
            // Pending Stripe subscription expires after 5 minutes
            window.localStorage.removeItem(`pendingStripeSubscriptionForTeam${team.id}`);
            clearTimeout(pollStripeSubscriptionTimeout!);
            setPendingStripeSubscription(undefined);
            return;
        }
        if (!pollStripeSubscriptionTimeout) {
            // Refresh Stripe subscription in 5 seconds in order to poll for upgrade confirmation
            const timeout = setTimeout(async () => {
                const subscriptionId = await getGitpodService().server.findStripeSubscriptionIdForTeam(team.id);
                setStripeSubscriptionId(subscriptionId);
                setPollStripeSubscriptionTimeout(undefined);
            }, 5000);
            setPollStripeSubscriptionTimeout(timeout);
        }
    }, [pendingStripeSubscription, pollStripeSubscriptionTimeout, stripeSubscriptionId, team]);

    if (!BillingMode.showUsageBasedBilling(teamBillingMode)) {
        return <></>;
    }

    const showSpinner = isLoading || !!pendingStripeSubscription;
    const showUpgradeBilling = !showSpinner && !stripeSubscriptionId;
    const showManageBilling = !showSpinner && !!stripeSubscriptionId;

    const doUpdateLimit = async (newLimit: number) => {
        if (!team) {
            return;
        }
        const oldLimit = usageLimit;
        setUsageLimit(newLimit);
        try {
            await getGitpodService().server.setUsageLimitForTeam(team.id, newLimit);
        } catch (error) {
            setUsageLimit(oldLimit);
            console.error(error);
            alert(error?.message || "Failed to update usage limit. See console for error message.");
        }
    };

    const attributionId: AttributionId = { kind: "team", teamId: team?.id || "" };

    return (
        <>
            {billingError && (
                <Alert className="max-w-xl mb-4" closable={false} showIcon={true} type="error">
                    {billingError}
                </Alert>
            )}
            <h3>Usage-Based Billing</h3>
            <UsageBasedBillingConfig
                attributionId={attributionId}
                showSpinner={showSpinner}
                showUpgradeBilling={showUpgradeBilling}
                showManageBilling={showManageBilling}
                stripePortalUrl={stripePortalUrl}
                usageLimit={usageLimit}
                doUpdateLimit={doUpdateLimit}
            />
        </>
    );
}
