/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { loadStripe } from "@stripe/stripe-js/pure";
import { useEffect, useState } from "react";
import { useStripePublishableKey } from "../../data/billing/stripe-key-query";

export const useStripePromise = () => {
    const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | undefined>();
    const { data: stripeKey, isLoading } = useStripePublishableKey();

    useEffect(() => {
        if (stripeKey && !stripePromise) {
            setStripePromise(loadStripe(stripeKey));
        }
    }, [stripeKey, stripePromise]);

    return {
        stripePromise,
        isLoading,
    };
};
