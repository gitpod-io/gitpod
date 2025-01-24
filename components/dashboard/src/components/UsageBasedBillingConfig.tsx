/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { Link } from "react-router-dom";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { ReactComponent as Spinner } from "../icons/Spinner.svg";
import { ReactComponent as Check } from "../images/check-circle.svg";
import { getGitpodService } from "../service/service";
import Alert from "./Alert";
import { Subheading } from "./typography/headings";
import { AddPaymentMethodModal } from "./billing/AddPaymentMethodModal";
import { useCreateHoldPaymentIntentMutation } from "../data/billing/create-hold-payment-intent-mutation";
import { useToast } from "./toasts/Toasts";
import { ProgressBar } from "./ProgressBar";
import { useListOrganizationMembers } from "../data/organizations/members-query";
import { Button } from "@podkit/buttons/Button";
import { LoadingButton } from "@podkit/buttons/LoadingButton";

const BASE_USAGE_LIMIT_FOR_STRIPE_USERS = 1000;

interface Props {
    hideSubheading?: boolean;
}

// Guard against multiple calls to subscripe (per page load)
let didAlreadyCallSubscribe = false;

export default function UsageBasedBillingConfig({ hideSubheading = false }: Props) {
    const currentOrg = useCurrentOrg().data;
    const attrId = currentOrg ? AttributionId.createFromOrganizationId(currentOrg.id) : undefined;
    const attributionId = attrId && AttributionId.render(attrId);
    const members = useListOrganizationMembers().data;
    const [showUpdateLimitModal, setShowUpdateLimitModal] = useState<boolean>(false);
    const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | undefined>();
    const [isLoadingStripeSubscription, setIsLoadingStripeSubscription] = useState<boolean>(true);
    const [currentUsage, setCurrentUsage] = useState<number>(0);
    const [usageLimit, setUsageLimit] = useState<number>(0);
    const [stripePortalUrl, setStripePortalUrl] = useState<string | undefined>();
    const [errorMessage, setErrorMessage] = useState<string | undefined>();
    const [priceInformation, setPriceInformation] = useState<string | undefined>();
    const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
    const createPaymentIntent = useCreateHoldPaymentIntentMutation();
    const [showAddPaymentMethodModal, setShowAddPaymentMethodModal] = useState<boolean>(false);
    const { toast } = useToast();

    // Stripe-controlled parameters
    const location = useLocation();

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

    const handleAddPaymentMethod = useCallback(async () => {
        if (!attributionId) {
            return;
        }

        try {
            createPaymentIntent.mutateAsync(attributionId);
            setShowAddPaymentMethodModal(true);
        } catch (e) {
            console.error(e);
            toast(e.message || "Oh no, there was a problem with our payment service.");
        }
    }, [attributionId, createPaymentIntent, toast]);

    // Handle stripe setup-intent or payment-intent redirect flow
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const paymentIntentId = params.get("payment_intent");
        const redirectStatus = params.get("redirect_status");
        if (paymentIntentId && redirectStatus) {
            subscribeToStripe({
                paymentIntentId: paymentIntentId || undefined,
                redirectStatus,
            });
        }
        // We only want to run this effect once on page load as we're handling a stripe redirect flow
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // TODO: put this in a useMutation()
    const subscribeToStripe = useCallback(
        async (stripeParams: { paymentIntentId?: string; redirectStatus: string }) => {
            if (!attributionId) {
                return;
            }
            const { paymentIntentId, redirectStatus } = stripeParams;

            // Should be at least one intent id
            if (!paymentIntentId) {
                return;
            }

            if (redirectStatus !== "succeeded") {
                // TODO(gpl) We have to handle external validation errors (3DS, e.g.) here
                return;
            }

            // Guard against multiple execution following the pattern here: https://react.dev/learn/you-might-not-need-an-effect#initializing-the-application
            if (didAlreadyCallSubscribe) {
                console.log("didAlreadyCallSubscribe, skipping this time.");
                return;
            }
            didAlreadyCallSubscribe = true;
            console.log("didAlreadyCallSubscribe false, first run.");

            // Remove the query params from the URL
            window.history.replaceState({}, "", location.pathname);

            try {
                setIsCreatingSubscription(true);
                // Pick a good initial value for the Stripe usage limit (base_limit * team_size)
                // FIXME: Should we ask the customer to confirm or edit this default limit?
                let limit = BASE_USAGE_LIMIT_FOR_STRIPE_USERS;
                if (attrId?.kind === "team" && currentOrg) {
                    limit = BASE_USAGE_LIMIT_FOR_STRIPE_USERS * (members?.length || 0);
                }
                const newLimit = await getGitpodService().server.subscribeToStripe(
                    attributionId,
                    paymentIntentId || "",
                    limit,
                );
                if (newLimit) {
                    setUsageLimit(newLimit);
                }

                // TODO: should change this to setTimeouts, reschedule at end of check, and wrap it in a Promise,
                // otherwise we can queue up many pending requests if they take longer than 1 second
                //refresh every second until we get a subscriptionId
                const interval = setInterval(async () => {
                    try {
                        const subscriptionId = await refreshSubscriptionDetails(attributionId);
                        if (subscriptionId) {
                            setIsCreatingSubscription(false);
                            clearInterval(interval);
                        }
                    } catch (error) {
                        console.error(error);
                    }
                }, 1000);
            } catch (error) {
                console.error("Could not subscribe to Stripe", error);
                setIsCreatingSubscription(false);
                setErrorMessage(
                    `Could not subscribe: ${
                        error?.message || String(error)
                    } Contact support@gitpod.io if you believe this is a system error.`,
                );
            }
        },
        [members, attrId?.kind, attributionId, currentOrg, location.pathname, refreshSubscriptionDetails],
    );

    const showSpinner = !attributionId || isLoadingStripeSubscription || isCreatingSubscription;
    const showBalance = !showSpinner;
    const showUpgradeTeam =
        !showSpinner && AttributionId.parse(attributionId)?.kind === "team" && !stripeSubscriptionId;
    const showManageBilling = !showSpinner && !!stripeSubscriptionId;

    const updateUsageLimit = useCallback(
        async (newLimit: number) => {
            if (!attributionId) {
                return;
            }

            try {
                await getGitpodService().server.setUsageLimit(attributionId, newLimit);
                setUsageLimit(newLimit);
                toast(`Your usage limit was updated to ${newLimit || 0}`);
            } catch (error) {
                console.error("Failed to update usage limit", error);
                setErrorMessage(`Failed to update usage limit. ${error?.message || String(error)}`);
            }
            setShowUpdateLimitModal(false);
        },
        [attributionId, toast],
    );

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
            {!hideSubheading && <Subheading>Manage billing for your organization.</Subheading>}
            <div className="max-w-xl flex flex-col">
                {errorMessage && (
                    <Alert className="max-w-xl mt-2" closable={false} showIcon={true} type="error">
                        {errorMessage}
                    </Alert>
                )}
                {showSpinner && (
                    <div className="flex flex-col mt-4 h-52 p-4 rounded-xl bg-pk-surface-secondary">
                        <div className="uppercase text-sm text-pk-content-tertiary">Balance</div>
                        <Spinner className="m-2 animate-spin" />
                    </div>
                )}
                {showBalance && (
                    <div className="flex flex-col mt-4 p-4 rounded-xl bg-pk-surface-secondary">
                        <div className="uppercase text-sm text-pk-content-tertiary">Balance</div>
                        <div className="mt-1 text-xl font-semibold flex-grow">
                            <span className="text-gray-900 dark:text-gray-100">
                                {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-pk-content-tertiary"> Credits</span>
                        </div>
                        <div className="mt-4 text-sm flex text-pk-content-tertiary">
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
                            <ProgressBar value={percentage} />
                        </div>
                        <div className="bg-pk-surface-secondary border-t border-gray-200 dark:border-gray-700 -m-4 p-4 mt-4 rounded-b-xl flex">
                            <div className="flex-grow">
                                <div className="uppercase text-sm text-pk-content-tertiary">Current Period</div>
                                <div className="text-sm font-medium text-pk-content-primary">
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
                                    }&start=${billingCycleFrom.format("YYYY-MM-DD")}&end=${billingCycleTo.format(
                                        "YYYY-MM-DD",
                                    )}`}
                                >
                                    <Button variant="secondary">View Usage →</Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
                {showUpgradeTeam && (
                    <>
                        <div className="flex flex-col mt-4 p-4 rounded-t-xl bg-pk-surface-secondary">
                            <div className="uppercase text-sm text-pk-content-tertiary">Current Plan</div>
                            <div className="mt-1 text-xl font-semibold flex-grow text-pk-content-secondary">
                                {freePlanName}
                            </div>
                            <div className="mt-4 flex space-x-1 text-pk-content-tertiary">
                                <div className="m-0.5 w-5 h-5 text-orange-500">
                                    <Check />
                                </div>
                                <div className="flex flex-col w-96">
                                    <span className="font-bold text-pk-content-secondary">{usageLimit} credits</span>
                                    <span>{usageLimit / 10} hours of Standard workspace usage.</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col p-4 rounded-b-xl bg-pk-surface-secondary border-t border-gray-200 dark:border-gray-700">
                            <div className="uppercase text-sm text-pk-content-tertiary">Upgrade Plan</div>
                            <div className="mt-1 text-xl font-semibold flex-grow text-pk-content-primary">
                                Pay-as-you-go
                            </div>
                            <div className="mt-4 flex space-x-1 text-pk-content-tertiary">
                                <div className="flex flex-col">
                                    <span>{priceInformation}</span>
                                </div>
                            </div>
                            <div className="flex justify-end mt-6 space-x-2">
                                {stripePortalUrl && (
                                    <a href={stripePortalUrl}>
                                        <Button variant="secondary" disabled={!stripePortalUrl}>
                                            View Past Invoices ↗
                                        </Button>
                                    </a>
                                )}
                                <LoadingButton loading={createPaymentIntent.isLoading} onClick={handleAddPaymentMethod}>
                                    Upgrade Plan
                                </LoadingButton>
                            </div>
                        </div>
                    </>
                )}
                {showManageBilling && (
                    <div className="max-w-xl flex space-x-4">
                        <div className="flex-grow flex flex-col mt-4 p-4 rounded-xl bg-pk-surface-secondary">
                            <div className="uppercase text-sm text-pk-content-tertiary">Current Plan</div>
                            <div className="mt-1 text-xl font-semibold flex-grow text-pk-content-primary">
                                Pay-as-you-go
                            </div>
                            <div className="mt-4 flex space-x-1 text-pk-content-tertiary">
                                <Check className="m-0.5 w-8 h-5 text-orange-500" />
                                <div className="flex flex-col">
                                    <span>{priceInformation}</span>
                                </div>
                            </div>

                            <a className="mt-5 self-end" href={stripePortalUrl}>
                                <Button variant="secondary" disabled={!stripePortalUrl}>
                                    Manage Billing Settings ↗
                                </Button>
                            </a>
                        </div>
                    </div>
                )}
            </div>
            {attributionId && createPaymentIntent.data && showAddPaymentMethodModal && (
                <AddPaymentMethodModal
                    attributionId={attributionId}
                    clientSecret={createPaymentIntent.data.paymentIntentClientSecret}
                    onClose={() => setShowAddPaymentMethodModal(false)}
                />
            )}
            {showUpdateLimitModal && (
                <UpdateLimitModal
                    minValue={0}
                    currentValue={usageLimit}
                    onClose={() => setShowUpdateLimitModal(false)}
                    onUpdate={async (newLimit) => await updateUsageLimit(newLimit)}
                />
            )}
        </div>
    );
}

function UpdateLimitModal(props: {
    minValue?: number;
    currentValue: number | undefined;
    onClose: () => void;
    onUpdate: (newLimit: number) => void;
}) {
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [newLimit, setNewLimit] = useState<string | undefined>(
        typeof props.currentValue === "number" ? String(props.currentValue) : undefined,
    );

    const onSubmit = useCallback(async () => {
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

        setIsSaving(true);
        await props.onUpdate(n);
        setIsSaving(false);
    }, [newLimit, props]);

    return (
        <Modal visible={true} onClose={props.onClose} onSubmit={onSubmit}>
            <ModalHeader>Usage Limit</ModalHeader>
            <ModalBody>
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
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={props.onClose}>
                    Cancel
                </Button>
                <LoadingButton type="submit" loading={isSaving}>
                    Update
                </LoadingButton>
            </ModalFooter>
        </Modal>
    );
}
