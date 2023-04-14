/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js/pure";
import { FC, useCallback, useContext, useMemo, useState } from "react";
import Modal, { ModalBody, ModalFooter, ModalFooterAlert, ModalHeader } from "../Modal";
import { ReactComponent as Spinner } from "../../icons/Spinner.svg";
import { getGitpodService } from "../../service/service";
import { ThemeContext } from "../../theme-context";
import { useMutation, useQuery } from "@tanstack/react-query";
import Alert from "../Alert";
import DropDown from "../DropDown";
import { Appearance } from "@stripe/stripe-js";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { PaymentContext } from "../../payment-context";
import { useStripePromise } from "./use-stripe-promise";
import { Button } from "../Button";

type BillingSetupModalProps = {
    attributionId: string;
    onClose: () => void;
};
export const BillingSetupModal: FC<BillingSetupModalProps> = (props) => {
    const { isDark } = useContext(ThemeContext);
    const { stripePromise } = useStripePromise();
    const { data: stripeSetupIntentClientSecret } = useQuery(["stripe-setup-intent-client-secret"], async () => {
        return await getGitpodService().server.getStripeSetupIntentClientSecret();
    });

    const elementsOptions = useMemo(
        () => ({
            appearance: getStripeAppearance(isDark),
            clientSecret: stripeSetupIntentClientSecret,
        }),
        [isDark, stripeSetupIntentClientSecret],
    );

    return (
        <Modal visible={true} onClose={props.onClose}>
            <ModalHeader>Upgrade Plan</ModalHeader>
            {(!stripePromise || !stripeSetupIntentClientSecret) && (
                <ModalBody>
                    <div className="h-80 flex items-center justify-center">
                        <Spinner className="h-5 w-5 animate-spin" />
                    </div>
                </ModalBody>
            )}
            {!!stripePromise && !!stripeSetupIntentClientSecret && (
                <Elements stripe={stripePromise} options={elementsOptions}>
                    <PaymentInputForm attributionId={props.attributionId} />
                </Elements>
            )}
        </Modal>
    );
};

function PaymentInputForm(props: { attributionId: string }) {
    const stripe = useStripe();
    const elements = useElements();
    const { currency, setCurrency } = useContext(PaymentContext);

    const confirmSetup = useMutation(async () => {
        const attrId = AttributionId.parse(props.attributionId);
        if (!stripe || !elements || !attrId) {
            return;
        }

        try {
            // Create Stripe customer with currency
            await getGitpodService().server.createStripeCustomerIfNeeded(props.attributionId, currency);

            // Make sure that after we return, proceed with the next step
            const url = new URL(window.location.href);
            url.searchParams.set("step", "verification");

            const result = await stripe.confirmSetup({
                elements,
                confirmParams: {
                    return_url: url.toString(),
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
            let message = `Failed to submit form. ${error?.message || String(error)}`;
            if (error && error.code === ErrorCodes.SUBSCRIPTION_ERROR) {
                message =
                    error.data?.hint === "currency"
                        ? error.message
                        : "Failed to subscribe. Please contact support@gitpod.io";
            }

            throw new Error(message);
        }
    });

    const handleSubmit = useCallback(
        (e) => {
            e.preventDefault();

            confirmSetup.mutate();
        },
        [confirmSetup],
    );

    return (
        <form onSubmit={handleSubmit}>
            <ModalBody>
                <PaymentElement id="payment-element" />
            </ModalBody>
            <ModalFooter
                className="justify-between"
                alert={
                    confirmSetup.isError ? (
                        <ModalFooterAlert closable={false} type="danger">
                            {(confirmSetup.error as Error).message}
                        </ModalFooterAlert>
                    ) : null
                }
            >
                <div className="flex items-center space-x-1">
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
                <Button disabled={!stripe} loading={confirmSetup.isLoading}>
                    Add Payment Method
                </Button>
            </ModalFooter>
        </form>
    );
}

export function getStripeAppearance(isDark?: boolean): Appearance {
    return {
        theme: isDark ? "night" : "stripe",
    };
}
