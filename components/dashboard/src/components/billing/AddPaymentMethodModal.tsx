/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { FC, useCallback, useMemo } from "react";
import Modal, { ModalBody, ModalFooter, ModalFooterAlert } from "../Modal";
import { ReactComponent as Spinner } from "../../icons/Spinner.svg";
import { Heading2 } from "../typography/headings";
import { useStripePromise } from "./use-stripe-promise";
import { Button } from "../Button";
import { useMutation } from "@tanstack/react-query";
import { useStripeAppearance } from "./use-stripe-appearance";

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
        <Modal visible={true} onClose={onClose}>
            <Heading2 className="flex">Add Payment Method</Heading2>
            {!stripePromise && (
                <ModalBody>
                    <div className="h-80 flex items-center justify-center">
                        <Spinner className="h-5 w-5 animate-spin" />
                    </div>
                </ModalBody>
            )}
            {!!stripePromise && (
                <Elements stripe={stripePromise} options={elementsOptions}>
                    <HoldVerificationForm attributionId={attributionId} />
                </Elements>
            )}
        </Modal>
    );
};

function HoldVerificationForm({ attributionId }: { attributionId: string }) {
    const stripe = useStripe();
    const elements = useElements();

    const confirmPayment = useMutation(async () => {
        const attrId = AttributionId.parse(attributionId);
        if (!stripe || !elements || !attrId) {
            return;
        }

        try {
            // TODO: look into using a nested sub-route for this instead of query param
            const url = new URL(window.location.href);
            url.searchParams.set("step", "subscribe");

            // Event though we might not request a payment right away, we want to use this sync opportunity to prepare clients as much as possible.
            // E.g., if they have to go through a flow like 3DS or iDEAL, they should do it ("online flow"), instead of ending up in the (email-based) "offline flow".
            const result = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: url.toString(),
                },
            });
            console.log("confirmPayment", result);
            if (result.error) {
                // Show error to your customer (for example, payment details incomplete)
                throw result.error;
            } else {
                // Your customer will be redirected to your `return_url`. For some payment
                // methods like iDEAL, your customer will be redirected to an intermediate
                // site first to authorize the payment, then redirected to the `return_url`.
                console.log("RESULT: " + JSON.stringify(result));
            }
        } catch (error) {
            console.error("Failed to submit form.", error);
            let message = `Failed to submit form. ${error?.message || String(error)}`;
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
                <PaymentElement id="payment-element" />
            </ModalBody>
            <ModalFooter
                alert={
                    confirmPayment.isError && (
                        <ModalFooterAlert closable={false} type="danger">
                            {(confirmPayment.error as Error).message}
                        </ModalFooterAlert>
                    )
                }
            >
                <Button disabled={!stripe} loading={confirmPayment.isLoading}>
                    Confirm
                </Button>
            </ModalFooter>
        </form>
    );
}
