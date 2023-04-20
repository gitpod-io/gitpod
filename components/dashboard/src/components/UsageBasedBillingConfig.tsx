/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import dayjs from "dayjs";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { Link } from "react-router-dom";
import Modal from "../components/Modal";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { ReactComponent as Spinner } from "../icons/Spinner.svg";
import { ReactComponent as Check } from "../images/check-circle.svg";
import { getGitpodService } from "../service/service";
import Alert from "./Alert";
import { Heading2, Subheading } from "./typography/headings";
import { Button } from "./Button";
import { BillingSetupModal } from "./billing/BillingSetupModal";
import { HoldVerificationModal } from "./billing/HoldVerificationModal";
import { PaymentContext } from "../payment-context";

const BASE_USAGE_LIMIT_FOR_STRIPE_USERS = 1000;

type PendingStripeSubscription = { pendingSince: number };

interface Props {
    attributionId?: string;
    hideSubheading?: boolean;
}

// Guard against multiple calls to subscripe (per page load)
let didAlreadyCallSubscribe = false;
let didStartVerification = false;

export default function UsageBasedBillingConfig({ attributionId, hideSubheading = false }: Props) {
    const currentOrg = useCurrentOrg().data;
    const attrId = attributionId ? AttributionId.parse(attributionId) : undefined;
    const [showUpdateLimitModal, setShowUpdateLimitModal] = useState<boolean>(false);
    const [showBillingSetupModal, setShowBillingSetupModal] = useState<boolean>(false);
    const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | undefined>();
    const [isLoadingStripeSubscription, setIsLoadingStripeSubscription] = useState<boolean>(true);
    const [currentUsage, setCurrentUsage] = useState<number>(0);
    const [usageLimit, setUsageLimit] = useState<number>(0);
    const [stripePortalUrl, setStripePortalUrl] = useState<string | undefined>();
    const [errorMessage, setErrorMessage] = useState<string | undefined>();
    const [priceInformation, setPriceInformation] = useState<string | undefined>();
    const [pendingStripeSubscription, setPendingStripeSubscription] = useState<PendingStripeSubscription | undefined>(
        undefined,
    );
    const { currency } = useContext(PaymentContext);

    // Stripe-controlled parameters
    const location = useLocation();

    // Hold verification
    const [showHoldVerificationModal, setShowHoldVerificationModal] = useState<boolean>(false);
    const [holdPaymentIntentInfo, setHoldPaymentIntentInfo] = useState<
        { paymentIntentId: string; paymentIntentClientSecret: string } | undefined
    >();

    const now = useMemo(() => dayjs().utc(true), []);
    const [billingCycleFrom, setBillingCycleFrom] = useState<dayjs.Dayjs>(now.startOf("month"));
    const [billingCycleTo, setBillingCycleTo] = useState<dayjs.Dayjs>(now.endOf("month"));
    useEffect(() => {
        if (attributionId) {
            getGitpodService().server.getPriceInformation(attributionId).then(setPriceInformation);
        }
    }, [attributionId]);

    const refreshSubscriptionDetails = useCallback(
        async (attributionId: string) => {
            setStripeSubscriptionId(undefined);
            setIsLoadingStripeSubscription(true);
            try {
                getGitpodService().server.getStripePortalUrl(attributionId).then(setStripePortalUrl);
                getGitpodService().server.getUsageBalance(attributionId).then(setCurrentUsage);
                const costCenter = await getGitpodService().server.getCostCenter(attributionId);
                setUsageLimit(costCenter?.spendingLimit || 0);
                setBillingCycleFrom(dayjs(costCenter?.billingCycleStart || now.startOf("month")).utc(true));
                setBillingCycleTo(dayjs(costCenter?.nextBillingTime || now.endOf("month")).utc(true));
                const subscriptionId = await getGitpodService().server.findStripeSubscriptionId(attributionId);
                setStripeSubscriptionId(subscriptionId);
                return subscriptionId;
            } catch (error) {
                console.error("Could not get Stripe subscription details.", error);
                setErrorMessage(`Could not get Stripe subscription details. ${error?.message || String(error)}`);
            } finally {
                setIsLoadingStripeSubscription(false);
            }
        },
        [now],
    );

    useEffect(() => {
        if (!attributionId) {
            return;
        }
        refreshSubscriptionDetails(attributionId);
    }, [attributionId, refreshSubscriptionDetails]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const setupIntentId = params.get("setup_intent");
        const paymentIntentId = params.get("payment_intent");
        const redirectStatus = params.get("redirect_status");
        const step = params.get("step");

        // TODO: Can hopefully remove this step if the hold payment intent can be used to also create the subscription
        if (step === "verification") {
            if (!attributionId) {
                return;
            }
            if (!setupIntentId) {
                return;
            }

            // Guard against multiple execution following the pattern here: https://react.dev/learn/you-might-not-need-an-effect#initializing-the-application
            if (didStartVerification) {
                console.log("didStartVerification, skipping this time.");
                return;
            }
            didStartVerification = true;
            console.log("didStartVerification false, first run.");

            (async () => {
                await getGitpodService().server.setDefaultPaymentMethod({
                    attributionId,
                    setupIntentId,
                });

                const holdPaymentInfo = await getGitpodService().server.createHoldPaymentIntent(attributionId);
                setHoldPaymentIntentInfo(holdPaymentInfo); // TODO(gpl): error handling, brittle
            })();
            setShowHoldVerificationModal(true);
        }
        // TODO: can we put this in a component in a nested-route, i.e. `/billing/subscribe`?
        if (step === "subscribe") {
            if (!attributionId || !paymentIntentId) {
                console.log('no attribution or payment intent id, skipping "subscribe" step');
                return;
            }

            if (redirectStatus !== "succeeded") {
                // TODO(gpl) We have to handle external validation errors (3DS, iDEAL) for both steps: verification and subscribe
                // https://stripe.com/docs/payments/3d-secure#check-status
                return;
            }

            // TODO: need error handling around this
            (async () => {
                // Set our default payment method
                await getGitpodService().server.setDefaultPaymentMethod({
                    attributionId,
                    // TODO: rename this field to paymentIntentId
                    setupIntentId: paymentIntentId,
                });

                // create subscription
                subscribeToStripe({ attributionId, holdPaymentIntentId: paymentIntentId });
            })();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // TODO: rename this
    const handleAddPaymentClick = useCallback(async () => {
        if (!attributionId) {
            return;
        }

        // Create stripe customer if needed
        await getGitpodService().server.createStripeCustomerIfNeeded(attributionId, currency);

        // create payment intent for hold and for subscription
        const holdPaymentInfo = await getGitpodService().server.createHoldPaymentIntent(attributionId);

        setHoldPaymentIntentInfo(holdPaymentInfo);
        setShowHoldVerificationModal(true);
    }, [attributionId, currency]);

    const subscribeToStripe = useCallback(
        (opts: { attributionId: string; holdPaymentIntentId?: string }) => {
            console.log("subscribeToStripe", opts);
            const { attributionId, holdPaymentIntentId } = opts;
            if (!holdPaymentIntentId) {
                return;
            }

            // Guard against multiple execution following the pattern here: https://react.dev/learn/you-might-not-need-an-effect#initializing-the-application
            if (didAlreadyCallSubscribe) {
                console.log("didAlreadyCallSubscripe, skipping this time.");
                return;
            }
            didAlreadyCallSubscribe = true;
            console.log("didAlreadyCallSubscripe false, first run.");

            window.history.replaceState({}, "", location.pathname);
            (async () => {
                const pendingSubscription = { pendingSince: Date.now() };
                try {
                    setPendingStripeSubscription(pendingSubscription);
                    // Pick a good initial value for the Stripe usage limit (base_limit * team_size)
                    // FIXME: Should we ask the customer to confirm or edit this default limit?
                    let limit = BASE_USAGE_LIMIT_FOR_STRIPE_USERS;
                    if (attrId?.kind === "team" && currentOrg) {
                        limit = BASE_USAGE_LIMIT_FOR_STRIPE_USERS * currentOrg.members.length;
                    }
                    const newLimit = await getGitpodService().server.subscribeToStripe(
                        attributionId,
                        holdPaymentIntentId,
                        limit,
                    );
                    if (newLimit) {
                        setUsageLimit(newLimit);
                    }

                    //refresh every 5 secs until we get a subscriptionId
                    const interval = setInterval(async () => {
                        try {
                            const subscriptionId = await refreshSubscriptionDetails(attributionId);
                            if (subscriptionId) {
                                setPendingStripeSubscription(undefined);
                                clearInterval(interval);
                            }
                        } catch (error) {
                            console.error(error);
                        }
                    }, 1000);
                } catch (error) {
                    console.error("Could not subscribe to Stripe", error);
                    setPendingStripeSubscription(undefined);
                    setErrorMessage(
                        `Could not subscribe: ${
                            error?.message || String(error)
                        } Contact support@gitpod.io if you believe this is a system error.`,
                    );
                }
            })();
        },
        [attrId?.kind, currentOrg, location.pathname, refreshSubscriptionDetails],
    );

    const showSpinner = !attributionId || isLoadingStripeSubscription || !!pendingStripeSubscription;
    const showBalance = !showSpinner;
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

    const balance = currentUsage * -1 + usageLimit;
    const percentage = usageLimit === 0 ? 0 : Math.max(Math.round((balance * 100) / usageLimit), 0);
    const freePlanName = useMemo(() => {
        if (usageLimit === 0) {
            return "No Plan";
        }
        return usageLimit > 500 ? "Open Source" : "Free";
    }, [usageLimit]);

    return (
        <div className="mb-16">
            {!hideSubheading && (
                <Subheading>
                    {attributionId && AttributionId.parse(attributionId)?.kind === "user"
                        ? "Manage billing for your personal account."
                        : "Manage billing for your organization."}
                </Subheading>
            )}
            <div className="max-w-xl flex flex-col">
                {errorMessage && (
                    <Alert className="max-w-xl mt-2" closable={false} showIcon={true} type="error">
                        {errorMessage}
                    </Alert>
                )}
                {showSpinner && (
                    <div className="flex flex-col mt-4 h-52 p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                        <div className="uppercase text-sm text-gray-400 dark:text-gray-500">Balance</div>
                        <Spinner className="m-2 animate-spin" />
                    </div>
                )}
                {showBalance && (
                    <div className="flex flex-col mt-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                        <div className="uppercase text-sm text-gray-400 dark:text-gray-500">Balance</div>
                        <div className="mt-1 text-xl font-semibold flex-grow">
                            <span className="text-gray-900 dark:text-gray-100">
                                {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-gray-400 dark:text-gray-500"> Credits</span>
                        </div>
                        <div className="mt-4 text-sm flex text-gray-400 dark:text-gray-500">
                            <span className="flex-grow">
                                {typeof currentUsage === "number" &&
                                    typeof usageLimit === "number" &&
                                    usageLimit > 0 && <span>{percentage}% remaining</span>}
                            </span>
                            <span>Monthly limit: {usageLimit} Credits</span>
                            {showManageBilling && (
                                <>
                                    <span>&nbsp;&middot;&nbsp;</span>
                                    <span className="gp-link" onClick={() => setShowUpdateLimitModal(true)}>
                                        Update limit
                                    </span>
                                </>
                            )}
                        </div>
                        <div className="mt-2 flex">
                            <progress className="h-2 flex-grow rounded-xl" value={percentage} max={100} />
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 -m-4 p-4 mt-4 rounded-b-xl flex">
                            <div className="flex-grow">
                                <div className="uppercase text-sm text-gray-400 dark:text-gray-500">Current Period</div>
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                    <span title={billingCycleFrom.toDate().toUTCString().replace("GMT", "UTC")}>
                                        {billingCycleFrom.format("MMM D, YYYY")}
                                    </span>{" "}
                                    &ndash;{" "}
                                    <span title={billingCycleTo.toDate().toUTCString().replace("GMT", "UTC")}>
                                        {billingCycleTo.format("MMM D, YYYY")}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <Link
                                    to={`/usage?org=${
                                        attrId?.kind === "team" ? attrId.teamId : "0"
                                    }#${billingCycleFrom.format("YYYY-MM-DD")}:${billingCycleTo.format("YYYY-MM-DD")}`}
                                >
                                    <button className="secondary">View Usage →</button>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
                {(showUpgradeTeam || showUpgradeUser) && (
                    <>
                        <div className="flex flex-col mt-4 p-4 rounded-t-xl bg-gray-50 dark:bg-gray-800">
                            <div className="uppercase text-sm text-gray-400 dark:text-gray-500">Current Plan</div>
                            <div className="mt-1 text-xl font-semibold flex-grow text-gray-600 dark:text-gray-400">
                                {freePlanName}
                            </div>
                            <div className="mt-4 flex space-x-1 text-gray-400 dark:text-gray-500">
                                <div className="m-0.5 w-5 h-5 text-orange-500">
                                    <Check />
                                </div>
                                <div className="flex flex-col w-96">
                                    <span className="font-bold text-gray-500 dark:text-gray-400">
                                        {usageLimit} credits
                                    </span>
                                    <span>{usageLimit / 10} hours of Standard workspace usage.</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col p-4 rounded-b-xl bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                            <div className="uppercase text-sm text-gray-400 dark:text-gray-500">Upgrade Plan</div>
                            <div className="mt-1 text-xl font-semibold flex-grow text-gray-800 dark:text-gray-100">
                                Pay-as-you-go
                            </div>
                            <div className="mt-4 flex space-x-1 text-gray-400 dark:text-gray-500">
                                <div className="m-0.5 w-8 h-5">
                                    <Check />
                                </div>
                                <div className="flex flex-col">
                                    <span>
                                        {priceInformation}{" "}
                                        <a className="gp-link" href="https://www.gitpod.io/pricing#cost-estimator">
                                            Estimate costs
                                        </a>
                                    </span>
                                </div>
                            </div>
                            <div className="flex justify-end mt-6 space-x-2">
                                {stripePortalUrl && (
                                    <a href={stripePortalUrl}>
                                        <button className="secondary" disabled={!stripePortalUrl}>
                                            View Past Invoices ↗
                                        </button>
                                    </a>
                                )}
                                {/* <Button onClick={() => setShowBillingSetupModal(true)}>Upgrade Plan</Button> */}
                                {/* <Button onClick={() => setShowHoldVerificationModal(true)}>Upgrade Plan</Button> */}
                                <Button onClick={handleAddPaymentClick}>Upgrade Plan</Button>
                            </div>
                        </div>
                    </>
                )}
                {showManageBilling && (
                    <div className="max-w-xl flex space-x-4">
                        <div className="flex-grow flex flex-col mt-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                            <div className="uppercase text-sm text-gray-400 dark:text-gray-500">Current Plan</div>
                            <div className="mt-1 text-xl font-semibold flex-grow text-gray-800 dark:text-gray-100">
                                Pay-as-you-go
                            </div>
                            <div className="mt-4 flex space-x-1 text-gray-400 dark:text-gray-500">
                                <Check className="m-0.5 w-8 h-5 text-orange-500" />
                                <div className="flex flex-col">
                                    <span>
                                        {priceInformation}{" "}
                                        <a className="gp-link" href="https://www.gitpod.io/pricing#cost-estimator">
                                            Estimate costs
                                        </a>
                                    </span>
                                </div>
                            </div>

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
            {!!attributionId && !!holdPaymentIntentInfo?.paymentIntentClientSecret && showHoldVerificationModal && (
                <HoldVerificationModal
                    clientSecret={holdPaymentIntentInfo?.paymentIntentClientSecret}
                    attributionId={attributionId}
                    onClose={() => setShowHoldVerificationModal(false)}
                />
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
            <Heading2 className="mb-4">Usage Limit</Heading2>
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
