/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { createContext, useContext, useMemo, useState } from "react";

export type Currency = "USD" | "EUR";

const PaymentContext = createContext<{
    currency: Currency;
    setCurrency: React.Dispatch<Currency>;
}>({
    currency: "USD",
    setCurrency: () => null,
});

const PaymentContextProvider: React.FC = ({ children }) => {
    const [currency, setCurrency] = useState<Currency>("USD");

    const ctx = useMemo(
        () => ({
            currency,
            setCurrency,
        }),
        [currency],
    );

    return <PaymentContext.Provider value={ctx}>{children}</PaymentContext.Provider>;
};

export { PaymentContext, PaymentContextProvider };

export const useCurrency = () => {
    return useContext(PaymentContext);
};
