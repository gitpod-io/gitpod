/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { Elements, PaymentElement, AddressElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { FC, useCallback, useMemo } from "react";
import Modal, { ModalBody, ModalFooter, ModalFooterAlert, ModalHeader } from "../Modal";
import { ReactComponent as Spinner } from "../../icons/Spinner.svg";
import { useStripePromise } from "./use-stripe-promise";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { useMutation } from "@tanstack/react-query";
import { useStripeAppearance } from "./use-stripe-appearance";
import DropDown from "../DropDown";
import { useCurrency } from "../../payment-context";
import Alert from "../Alert";

type Props = {
    attributionId: string;
    clientSecret: string;
    onClose: () => void;
};
export const AddPaymentMethodModal: FC<Props> = ({ attributionId, clientSecret, onClose }) => {
    const appearance = useStripeAppearance();
    const { stripePromise } = useStripePromise();

    const elementsOptions = useMemo(
        () => ({
            appearance,
            clientSecret,
        }),
        [appearance, clientSecret],
    );

    return (
        // Because we potentially have an 3DS verification iframe (appended to document.body) don't lock focus to modal
        <Modal visible={true} onClose={onClose} disableFocusLock>
            <ModalHeader>Add Payment Method</ModalHeader>
            {!stripePromise ? (
                <ModalBody>
                    <div className="h-80 flex items-center justify-center">
                        <Spinner className="animate-spin" />
                    </div>
                </ModalBody>
            ) : (
                <Elements stripe={stripePromise} options={elementsOptions}>
                    <AddPaymentMethodForm attributionId={attributionId} />
                </Elements>
            )}
        </Modal>
    );
};

function AddPaymentMethodForm({ attributionId }: { attributionId: string }) {
    const stripe = useStripe();
    const elements = useElements();
    const { currency, setCurrency } = useCurrency();

    const confirmPayment = useMutation(async () => {
        const attrId = AttributionId.parse(attributionId);
        if (!stripe || !elements || !attrId) {
            return;
        }

        try {
            const url = new URL(window.location.href);

            // Event though we might not request a payment right away, we want to use this sync opportunity to prepare clients as much as possible.
            // E.g., if they have to go through a flow like 3DS or iDEAL, they should do it ("online flow"), instead of ending up in the (email-based) "offline flow".
            const { error } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: url.toString(),
                },
            });
            if (error) {
                throw error;
            }
        } catch (error) {
            console.error("Unable to confirm payment method.", error);
            let message = error?.message || String(error) || "Unable to confirm your payment method.";
            throw new Error(message);
        }
    });

    const handleSubmit = useCallback(
        (e) => {
            e.preventDefault();
            confirmPayment.mutate();
        },
        [confirmPayment],
    );

    return (
        <form onSubmit={handleSubmit}>
            <ModalBody>
                <Alert type="message" className="mb-4">
                    This card will be used for future charges. We'll be placing a 1.00 hold on it that we'll immediately
                    release in order to verify your payment method.
                </Alert>
                <PaymentElement id="payment-element" />
                <AddressElement id="address-element" options={{ mode: "billing", display: { name: "organization" } }} />
            </ModalBody>
            <ModalFooter
                className="justify-between"
                alert={
                    confirmPayment.isError && (
                        <ModalFooterAlert closable={false} type="danger">
                            {(confirmPayment.error as Error).message}
                        </ModalFooterAlert>
                    )
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
                <LoadingButton type="submit" disabled={!stripe} loading={confirmPayment.isLoading}>
                    Confirm
                </LoadingButton>
            </ModalFooter>
        </form>
    );
}
