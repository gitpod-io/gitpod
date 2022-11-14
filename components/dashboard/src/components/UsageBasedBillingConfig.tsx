/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useState, useContext, useEffect } from "react";
import { useLocation } from "react-router";
import { Link } from "react-router-dom";
import { Appearance, loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { Ordering } from "@gitpod/gitpod-protocol/lib/usage";
import { ReactComponent as Spinner } from "../icons/Spinner.svg";
import { ReactComponent as Check } from "../images/check-circle.svg";
import { ThemeContext } from "../theme-context";
import { PaymentContext } from "../payment-context";
import { getGitpodService } from "../service/service";
import DropDown from "../components/DropDown";
import Modal from "../components/Modal";
import Alert from "./Alert";
import dayjs from "dayjs";

const BASE_USAGE_LIMIT_FOR_STRIPE_USERS = 1000;

type PendingStripeSubscription = { pendingSince: number };

interface Props {
    attributionId?: string;
}

export default function UsageBasedBillingConfig({ attributionId }: Props) {
    const location = useLocation();
    const { currency } = useContext(PaymentContext);
    const [showUpdateLimitModal, setShowUpdateLimitModal] = useState<boolean>(false);
    const [showBillingSetupModal, setShowBillingSetupModal] = useState<boolean>(false);
    const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | undefined>();
    const [isLoadingStripeSubscription, setIsLoadingStripeSubscription] = useState<boolean>(true);
    const [currentUsage, setCurrentUsage] = useState<number | undefined>();
    const [usageLimit, setUsageLimit] = useState<number | undefined>();
    const [stripePortalUrl, setStripePortalUrl] = useState<string | undefined>();
    const [pollStripeSubscriptionTimeout, setPollStripeSubscriptionTimeout] = useState<NodeJS.Timeout | undefined>();
    const [pendingStripeSubscription, setPendingStripeSubscription] = useState<PendingStripeSubscription | undefined>();
    const [errorMessage, setErrorMessage] = useState<string | undefined>();

    const localStorageKey = `pendingStripeSubscriptionFor${attributionId}`;
    const now = dayjs().utc(true);
    const [billingCycleFrom, setBillingCycleFrom] = useState<dayjs.Dayjs>(now.startOf("month"));
    const [billingCycleTo, setBillingCycleTo] = useState<dayjs.Dayjs>(now.endOf("month"));

    const refreshSubscriptionDetails = async (attributionId: string) => {
        setStripeSubscriptionId(undefined);
        setIsLoadingStripeSubscription(true);
        try {
            const [subscriptionId, costCenter] = await Promise.all([
                getGitpodService().server.findStripeSubscriptionId(attributionId),
                getGitpodService().server.getCostCenter(attributionId),
            ]);
            setStripeSubscriptionId(subscriptionId);
            setUsageLimit(costCenter?.spendingLimit);
            setBillingCycleFrom(dayjs(costCenter?.billingCycleStart || now.startOf("month")).utc(true));
            setBillingCycleTo(dayjs(costCenter?.nextBillingTime || now.endOf("month")).utc(true));
        } catch (error) {
            console.error("Could not get Stripe subscription details.", error);
            setErrorMessage(`Could not get Stripe subscription details. ${error?.message || String(error)}`);
        } finally {
            setIsLoadingStripeSubscription(false);
        }
    };

    useEffect(() => {
        if (!attributionId) {
            return;
        }
        refreshSubscriptionDetails(attributionId);
    }, [attributionId]);

    useEffect(() => {
        if (!attributionId || !stripeSubscriptionId) {
            return;
        }
        (async () => {
            const portalUrl = await getGitpodService().server.getStripePortalUrl(attributionId);
            setStripePortalUrl(portalUrl);
        })();
    }, [attributionId, stripeSubscriptionId]);

    useEffect(() => {
        if (!attributionId) {
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
                // Pick a good initial value for the Stripe usage limit (base_limit * team_size)
                // FIXME: Should we ask the customer to confirm or edit this default limit?
                let limit = BASE_USAGE_LIMIT_FOR_STRIPE_USERS;
                const attrId = AttributionId.parse(attributionId);
                if (attrId?.kind === "team") {
                    const members = await getGitpodService().server.getTeamMembers(attrId.teamId);
                    limit = BASE_USAGE_LIMIT_FOR_STRIPE_USERS * members.length;
                }
                const newLimit = await getGitpodService().server.subscribeToStripe(attributionId, setupIntentId, limit);
                if (newLimit) {
                    setUsageLimit(newLimit);
                }
            } catch (error) {
                console.error("Could not subscribe to Stripe", error);
                window.localStorage.removeItem(localStorageKey);
                clearTimeout(pollStripeSubscriptionTimeout!);
                setPendingStripeSubscription(undefined);
                setErrorMessage(`Could not subscribe to Stripe. ${error?.message || String(error)}`);
            }
        })();
    }, [attributionId, location.search]);

    useEffect(() => {
        setPendingStripeSubscription(undefined);
        if (!attributionId) {
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
            console.warn("Could not load pending Stripe subscription", attributionId, error);
        }
    }, [attributionId, localStorageKey]);

    useEffect(() => {
        if (!pendingStripeSubscription || !attributionId) {
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
                await refreshSubscriptionDetails(attributionId);
                setPollStripeSubscriptionTimeout(undefined);
            }, 5000);
            setPollStripeSubscriptionTimeout(timeout);
        }
    }, [
        pendingStripeSubscription,
        pollStripeSubscriptionTimeout,
        stripeSubscriptionId,
        attributionId,
        localStorageKey,
    ]);

    useEffect(() => {
        if (!attributionId) {
            return;
        }
        (async () => {
            const response = await getGitpodService().server.listUsage({
                attributionId,
                order: Ordering.ORDERING_DESCENDING,
                from: billingCycleFrom.toDate().getTime(),
                to: Date.now(),
            });
            setCurrentUsage(response.creditsUsed);
        })();
    }, [attributionId, billingCycleFrom]);

    const showSpinner = !attributionId || isLoadingStripeSubscription || !!pendingStripeSubscription;
    const showBalance = !showSpinner && !(AttributionId.parse(attributionId)?.kind === "team" && !stripeSubscriptionId);
    const showUpgradeTeam =
        !showSpinner && AttributionId.parse(attributionId)?.kind === "team" && !stripeSubscriptionId;
    const showUpgradeUser =
        !showSpinner && AttributionId.parse(attributionId)?.kind === "user" && !stripeSubscriptionId;
    const showManageBilling = !showSpinner && !!stripeSubscriptionId;

    const updateUsageLimit = async (newLimit: number) => {
        if (!attributionId) {
            return;
        }
        setShowUpdateLimitModal(false);
        try {
            await getGitpodService().server.setUsageLimit(attributionId, newLimit);
            setUsageLimit(newLimit);
        } catch (error) {
            console.error("Failed to update usage limit", error);
            setErrorMessage(`Failed to update usage limit. ${error?.message || String(error)}`);
        }
    };

    return (
        <div className="mb-16">
            <h2 className="text-gray-500">Manage usage-based billing, usage limit, and payment method.</h2>
            <div className="max-w-xl flex flex-col">
                {errorMessage && (
                    <Alert className="max-w-xl mt-2" closable={false} showIcon={true} type="error">
                        {errorMessage}
                    </Alert>
                )}
                {showSpinner && (
                    <div className="flex flex-col mt-4 h-52 p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                        <div className="uppercase text-sm text-gray-400 dark:text-gray-500">Balance Used</div>
                        <Spinner className="m-2 h-5 w-5 animate-spin" />
                    </div>
                )}
                {showBalance && (
                    <div className="flex flex-col mt-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                        <div className="uppercase text-sm text-gray-400 dark:text-gray-500">Balance Used</div>
                        <div className="mt-1 text-xl font-semibold flex-grow">
                            <span className="text-gray-900 dark:text-gray-100">
                                {typeof currentUsage === "number" ? Math.round(currentUsage) : "?"}
                            </span>
                            <span className="text-gray-400 dark:text-gray-500">
                                {" "}
                                / {usageLimit} Credit{usageLimit === 1 ? "" : "s"}
                            </span>
                        </div>
                        <div className="mt-4 text-sm flex">
                            <span className="flex-grow">
                                {showManageBilling && (
                                    <button className="gp-link" onClick={() => setShowUpdateLimitModal(true)}>
                                        Manage Usage Limit
                                    </button>
                                )}
                            </span>
                            {typeof currentUsage === "number" && typeof usageLimit === "number" && usageLimit > 0 && (
                                <span className="text-gray-400 dark:text-gray-500">
                                    {Math.round((100 * currentUsage) / usageLimit)}% used
                                </span>
                            )}
                        </div>
                        <div className="mt-2 flex">
                            <progress className="h-2 flex-grow rounded-xl" value={currentUsage} max={usageLimit} />
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 -m-4 p-4 mt-4 rounded-b-xl flex">
                            <div className="flex-grow">
                                <div className="uppercase text-sm text-gray-400 dark:text-gray-500">Current Period</div>
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                    <span className="font-semibold">{`${billingCycleFrom.format("MMMM YYYY")}`}</span> (
                                    <span title={billingCycleFrom.toDate().toUTCString().replace("GMT", "UTC")}>
                                        {billingCycleFrom.format("MMM D")}
                                    </span>{" "}
                                    -{" "}
                                    <span title={billingCycleTo.toDate().toUTCString().replace("GMT", "UTC")}>
                                        {billingCycleTo.format("MMM D")}
                                    </span>
                                    )
                                </div>
                            </div>
                            <div>
                                <Link
                                    to={`./usage#${billingCycleFrom.format("YYYY-MM-DD")}:${billingCycleTo.format(
                                        "YYYY-MM-DD",
                                    )}`}
                                >
                                    <button className="secondary">View Usage →</button>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
                {showUpgradeTeam && (
                    <div className="flex flex-col mt-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                        <div className="uppercase text-sm text-gray-400 dark:text-gray-500">Upgrade Plan</div>
                        <div className="mt-1 text-xl font-semibold flex-grow text-gray-500 dark:text-gray-400">
                            Pay-as-you-go
                        </div>
                        <div className="mt-4 flex space-x-1 text-gray-400 dark:text-gray-500">
                            <Check className="m-0.5 w-5 h-5" />
                            <div className="flex flex-col">
                                <span>
                                    {currency === "EUR" ? "€" : "$"}0.36 for 10 credits or 1 hour of Standard workspace
                                    usage.{" "}
                                    <a
                                        className="gp-link"
                                        href="https://www.gitpod.io/docs/configure/billing/usage-based-billing"
                                    >
                                        Learn more about credits
                                    </a>
                                </span>
                            </div>
                        </div>
                        <button className="mt-5 self-end" onClick={() => setShowBillingSetupModal(true)}>
                            Upgrade Plan
                        </button>
                    </div>
                )}
                {showUpgradeUser && (
                    <div className="flex flex-col mt-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                        <div className="uppercase text-sm text-gray-400 dark:text-gray-500">Current Plan</div>
                        <div className="mt-1 text-xl font-semibold flex-grow text-gray-600 dark:text-gray-400">
                            Free
                        </div>
                        <div className="mt-4 flex space-x-1 text-gray-400 dark:text-gray-500">
                            <Check className="m-0.5 w-5 h-5 text-orange-500" />
                            <div className="flex flex-col">
                                <span className="font-bold text-gray-500 dark:text-gray-400">500 credits</span>
                                <span>
                                    50 hours of Standard workspace usage.{" "}
                                    <a
                                        className="gp-link"
                                        href="https://www.gitpod.io/docs/configure/billing/usage-based-billing"
                                    >
                                        Learn more about credits
                                    </a>
                                </span>
                            </div>
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 -m-4 p-4 mt-8 rounded-b-xl">
                            <div className="uppercase text-sm text-gray-400 dark:text-gray-500">Upgrade Plan</div>
                            <div className="mt-1 text-xl font-semibold flex-grow text-gray-500 dark:text-gray-400">
                                {currency === "EUR" ? "€" : "$"}9 / month
                            </div>
                            <div className="mt-4 flex space-x-1 text-gray-400 dark:text-gray-500">
                                <Check className="m-0.5 w-5 h-5" />
                                <div className="flex flex-col">
                                    <span className="font-bold">1,000 credits</span>
                                </div>
                            </div>
                            <div className="mt-2 flex space-x-1 text-gray-400 dark:text-gray-500">
                                <Check className="m-0.5 w-5 h-5" />
                                <div className="flex flex-col">
                                    <span className="font-bold">Pay-as-you-go after 1,000 credits</span>
                                    <span>
                                        {currency === "EUR" ? "€" : "$"}0.36 for 10 credits or 1 hour of Standard
                                        workspace usage.
                                    </span>
                                </div>
                            </div>
                            <div className="mt-5 flex flex-col">
                                <button className="self-end" onClick={() => setShowBillingSetupModal(true)}>
                                    Upgrade Plan
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {showManageBilling && (
                    <div className="max-w-xl flex space-x-4">
                        <div className="flex-grow flex flex-col mt-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                            <div className="uppercase text-sm text-gray-400 dark:text-gray-500">Current Plan</div>
                            {AttributionId.parse(attributionId)?.kind === "user" ? (
                                <>
                                    <div className="mt-1 text-xl font-semibold flex-grow text-gray-800 dark:text-gray-100">
                                        {currency === "EUR" ? "€" : "$"}9 / month
                                    </div>
                                    <div className="mt-4 flex space-x-1 text-gray-400 dark:text-gray-500">
                                        <Check className="m-0.5 w-5 h-5 text-orange-500" />
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-500 dark:text-gray-400">
                                                1,000 credits
                                            </span>
                                            <span>
                                                100 hours of Standard workspace usage.{" "}
                                                <a
                                                    className="gp-link"
                                                    href="https://www.gitpod.io/docs/configure/billing/usage-based-billing"
                                                >
                                                    Learn more about credits
                                                </a>
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex space-x-1 text-gray-400 dark:text-gray-500">
                                        <Check className="m-0.5 w-5 h-5 text-orange-500" />
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-500 dark:text-gray-400">
                                                Pay-as-you-go after 1,000 credits
                                            </span>
                                            <span>
                                                {currency === "EUR" ? "€" : "$"}0.36 for 10 credits or 1 hour of
                                                Standard workspace usage.
                                            </span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="mt-1 text-xl font-semibold flex-grow text-gray-800 dark:text-gray-100">
                                        Pay-as-you-go
                                    </div>
                                    <div className="mt-4 flex space-x-1 text-gray-400 dark:text-gray-500">
                                        <Check className="m-0.5 w-5 h-5 text-orange-500" />
                                        <div className="flex flex-col">
                                            <span>
                                                {currency === "EUR" ? "€" : "$"}0.36 for 10 credits or 1 hour of
                                                Standard workspace usage.{" "}
                                                <a
                                                    className="gp-link"
                                                    href="https://www.gitpod.io/docs/configure/billing/usage-based-billing"
                                                >
                                                    Learn more about credits
                                                </a>
                                            </span>
                                        </div>
                                    </div>
                                </>
                            )}
                            <a className="mt-5 self-end" href={stripePortalUrl}>
                                <button className="secondary" disabled={!stripePortalUrl}>
                                    Manage Plan ↗
                                </button>
                            </a>
                        </div>
                    </div>
                )}
            </div>
            {!!attributionId && showBillingSetupModal && (
                <BillingSetupModal attributionId={attributionId} onClose={() => setShowBillingSetupModal(false)} />
            )}
            {showUpdateLimitModal && (
                <UpdateLimitModal
                    minValue={
                        AttributionId.parse(attributionId || "")?.kind === "user"
                            ? BASE_USAGE_LIMIT_FOR_STRIPE_USERS
                            : 0
                    }
                    currentValue={usageLimit}
                    onClose={() => setShowUpdateLimitModal(false)}
                    onUpdate={(newLimit) => updateUsageLimit(newLimit)}
                />
            )}
        </div>
    );
}

function BillingSetupModal(props: { attributionId: string; onClose: () => void }) {
    const { isDark } = useContext(ThemeContext);
    const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | undefined>();
    const [stripeSetupIntentClientSecret, setStripeSetupIntentClientSecret] = useState<string | undefined>();

    useEffect(() => {
        const { server } = getGitpodService();
        Promise.all([
            server.getStripePublishableKey().then((v) => () => setStripePromise(loadStripe(v))),
            server.getStripeSetupIntentClientSecret().then((v) => () => setStripeSetupIntentClientSecret(v)),
        ]).then((setters) => setters.forEach((s) => s()));
    }, []);

    return (
        <Modal visible={true} onClose={props.onClose}>
            <h3 className="flex">Upgrade Plan</h3>
            <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-2 -mx-6 px-6 flex flex-col">
                {(!stripePromise || !stripeSetupIntentClientSecret) && (
                    <div className="h-80 flex items-center justify-center">
                        <Spinner className="h-5 w-5 animate-spin" />
                    </div>
                )}
                {!!stripePromise && !!stripeSetupIntentClientSecret && (
                    <Elements
                        stripe={stripePromise}
                        options={{
                            appearance: getStripeAppearance(isDark),
                            clientSecret: stripeSetupIntentClientSecret,
                        }}
                    >
                        <CreditCardInputForm attributionId={props.attributionId} />
                    </Elements>
                )}
            </div>
        </Modal>
    );
}

function getStripeAppearance(isDark?: boolean): Appearance {
    return {
        theme: isDark ? "night" : "stripe",
    };
}

function CreditCardInputForm(props: { attributionId: string }) {
    const stripe = useStripe();
    const elements = useElements();
    const { currency, setCurrency } = useContext(PaymentContext);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | undefined>();

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const attrId = AttributionId.parse(props.attributionId);
        if (!stripe || !elements || !attrId) {
            return;
        }
        setErrorMessage(undefined);
        setIsLoading(true);
        try {
            // Create Stripe customer with currency
            await getGitpodService().server.createStripeCustomerIfNeeded(props.attributionId, currency);
            const result = await stripe.confirmSetup({
                elements,
                confirmParams: {
                    return_url: window.location.href,
                },
            });
            if (result.error) {
                // Show error to your customer (for example, payment details incomplete)
                throw result.error;
            } else {
                // Your customer will be redirected to your `return_url`. For some payment
                // methods like iDEAL, your customer will be redirected to an intermediate
                // site first to authorize the payment, then redirected to the `return_url`.
            }
        } catch (error) {
            console.error("Failed to submit form.", error);
            setErrorMessage(`Failed to submit form. ${error?.message || String(error)}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form className="mt-4 flex-grow flex flex-col" onSubmit={handleSubmit}>
            {errorMessage && (
                <Alert className="mb-4" closable={false} showIcon={true} type="error">
                    {errorMessage}
                </Alert>
            )}
            <PaymentElement />
            <div className="mt-4 flex-grow flex justify-end items-end">
                <div className="flex-grow flex space-x-1">
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
                <button className="my-0 flex items-center space-x-2" disabled={!stripe || isLoading}>
                    <span>Add Payment Method</span>
                    {isLoading && <Spinner className="h-5 w-5 animate-spin filter brightness-150" />}
                </button>
            </div>
        </form>
    );
}

function UpdateLimitModal(props: {
    minValue?: number;
    currentValue: number | undefined;
    onClose: () => void;
    onUpdate: (newLimit: number) => {};
}) {
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [newLimit, setNewLimit] = useState<string | undefined>(
        typeof props.currentValue === "number" ? String(props.currentValue) : undefined,
    );

    function onSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (!newLimit) {
            setErrorMessage("Please specify a limit");
            return;
        }
        const n = parseInt(newLimit, 10);
        if (typeof n !== "number") {
            setErrorMessage("Please specify a limit that is a valid number");
            return;
        }
        if (typeof props.minValue === "number" && n < props.minValue) {
            setErrorMessage(`Please specify a limit that is >= ${props.minValue}`);
            return;
        }
        props.onUpdate(n);
    }

    return (
        <Modal visible={true} onClose={props.onClose} onEnter={() => false}>
            <h3 className="mb-4">Usage Limit</h3>
            <form onSubmit={onSubmit}>
                <div className="border-t border-b border-gray-200 dark:border-gray-700 -mx-6 px-6 py-4 flex flex-col">
                    <p className="pb-4 text-gray-500 text-base">Set usage limit in total credits per month.</p>
                    {errorMessage && (
                        <Alert type="error" className="-mt-2 mb-2">
                            {errorMessage}
                        </Alert>
                    )}
                    <label className="font-medium">
                        Credits
                        <div className="w-full">
                            <input
                                type="text"
                                value={newLimit}
                                className={`rounded-md w-full truncate overflow-x-scroll pr-8 ${
                                    errorMessage ? "error" : ""
                                }`}
                                onChange={(e) => {
                                    setErrorMessage("");
                                    setNewLimit(e.target.value);
                                }}
                            />
                        </div>
                    </label>
                </div>
                <div className="flex justify-end mt-6 space-x-2">
                    <button className="secondary">Update</button>
                </div>
            </form>
        </Modal>
    );
}
