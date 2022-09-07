/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useState, useContext, useEffect } from "react";
import { Appearance, loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { ReactComponent as Spinner } from "../icons/Spinner.svg";
import { ThemeContext } from "../theme-context";
import { PaymentContext } from "../payment-context";
import { getGitpodService } from "../service/service";
import DropDown from "../components/DropDown";
import Modal from "../components/Modal";

interface Props {
    userOrTeamId: string;
    showSpinner: boolean;
    showUpgradeBilling: boolean;
    showManageBilling: boolean;
    stripePortalUrl?: string;
    usageLimit?: number;
    doUpdateLimit: (newLimit: number) => Promise<void>;
}

export default function UsageBasedBillingConfig({
    userOrTeamId,
    showSpinner,
    showUpgradeBilling,
    showManageBilling,
    stripePortalUrl,
    usageLimit,
    doUpdateLimit,
}: Props) {
    const [showUpdateLimitModal, setShowUpdateLimitModal] = useState<boolean>(false);
    const [showBillingSetupModal, setShowBillingSetupModal] = useState<boolean>(false);

    const onLimitUpdated = async (newLimit: number) => {
        await doUpdateLimit(newLimit);
        setShowUpdateLimitModal(false);
    };

    return (
        <div className="mb-16">
            <h2 className="text-gray-500">Manage usage-based billing, usage limit, and payment method.</h2>
            <div className="max-w-xl flex flex-col">
                {showSpinner && (
                    <div className="flex flex-col mt-4 h-32 p-4 rounded-xl bg-gray-100 dark:bg-gray-800">
                        <div className="uppercase text-sm text-gray-400 dark:text-gray-500">Billing</div>
                        <Spinner className="m-2 h-5 w-5 animate-spin" />
                    </div>
                )}
                {showUpgradeBilling && (
                    <div className="flex flex-col mt-4 h-32 p-4 rounded-xl bg-gray-100 dark:bg-gray-800">
                        <div className="uppercase text-sm text-gray-400 dark:text-gray-500">Billing</div>
                        <div className="text-xl font-semibold flex-grow text-gray-600 dark:text-gray-400">Inactive</div>
                        <button className="self-end" onClick={() => setShowBillingSetupModal(true)}>
                            Upgrade Billing
                        </button>
                    </div>
                )}
                {showManageBilling && (
                    <div className="max-w-xl flex space-x-4">
                        <div className="flex flex-col w-72 mt-4 h-32 p-4 rounded-xl bg-gray-100 dark:bg-gray-800">
                            <div className="uppercase text-sm text-gray-400 dark:text-gray-500">Billing</div>
                            <div className="text-xl font-semibold flex-grow text-gray-600 dark:text-gray-400">
                                Active
                            </div>
                            <a className="self-end" href={stripePortalUrl}>
                                <button className="secondary" disabled={!stripePortalUrl}>
                                    Manage Billing →
                                </button>
                            </a>
                        </div>
                        <div className="flex flex-col w-72 mt-4 h-32 p-4 rounded-xl bg-gray-100 dark:bg-gray-800">
                            <div className="uppercase text-sm text-gray-400 dark:text-gray-500">
                                Usage Limit (Credits)
                            </div>
                            <div className="text-xl font-semibold flex-grow text-gray-600 dark:text-gray-400">
                                {usageLimit || "–"}
                            </div>
                            <button className="self-end" onClick={() => setShowUpdateLimitModal(true)}>
                                Update Limit
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {showBillingSetupModal && (
                <BillingSetupModal id={userOrTeamId} onClose={() => setShowBillingSetupModal(false)} />
            )}
            {showUpdateLimitModal && (
                <UpdateLimitModal
                    currentValue={usageLimit}
                    onClose={() => setShowUpdateLimitModal(false)}
                    onUpdate={(newLimit) => onLimitUpdated(newLimit)}
                />
            )}
        </div>
    );
}

function BillingSetupModal(props: { id: string; onClose: () => void }) {
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
            <h3 className="flex">Upgrade Billing</h3>
            <div className="border-t border-gray-200 dark:border-gray-800 mt-4 pt-2 -mx-6 px-6 flex flex-col">
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
                        <CreditCardInputForm id={props.id} />
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

function CreditCardInputForm(props: { id: string }) {
    const stripe = useStripe();
    const elements = useElements();
    const { currency, setCurrency } = useContext(PaymentContext);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!stripe || !elements) {
            return;
        }
        setIsLoading(true);
        try {
            // Create Stripe customer for team & currency (or update currency)
            await getGitpodService().server.createOrUpdateStripeCustomerForTeam(props.id, currency);
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
            console.error(error);
            alert(error?.message || "Failed to submit form. See console for error message.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form className="mt-4 flex-grow flex flex-col" onSubmit={handleSubmit}>
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
    currentValue: number | undefined;
    onClose: () => void;
    onUpdate: (newLimit: number) => {};
}) {
    const [newLimit, setNewLimit] = useState<string | undefined>(
        props.currentValue ? String(props.currentValue) : undefined,
    );

    return (
        <Modal visible={true} onClose={props.onClose}>
            <h3 className="flex">Usage Limit</h3>
            <div className="border-t border-b border-gray-200 dark:border-gray-800 -mx-6 px-6 py-4 flex flex-col">
                <p className="pb-4 text-gray-500 text-base">Set usage limit in total credits per month.</p>

                <label className="font-medium">
                    Credits
                    <div className="w-full">
                        <input
                            type="number"
                            min={0}
                            value={newLimit}
                            className="rounded-md w-full truncate overflow-x-scroll pr-8"
                            onChange={(e) => setNewLimit(e.target.value)}
                        />
                    </div>
                </label>
            </div>
            <div className="flex justify-end mt-6 space-x-2">
                <button
                    className="secondary"
                    onClick={() => {
                        if (!newLimit) {
                            return;
                        }
                        const n = parseInt(newLimit, 10);
                        if (typeof n !== "number") {
                            return;
                        }
                        props.onUpdate(n);
                    }}
                >
                    Update
                </button>
            </div>
        </Modal>
    );
}
