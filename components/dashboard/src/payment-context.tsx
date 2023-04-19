/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { createContext, useState } from "react";
import { Currency } from "@gitpod/gitpod-protocol/lib/plans";

const PaymentContext = createContext<{
    currency: Currency;
    setCurrency: React.Dispatch<Currency>;
}>({
    currency: "USD",
    setCurrency: () => null,
});

const PaymentContextProvider: React.FC = ({ children }) => {
    const [currency, setCurrency] = useState<Currency>("USD");

    return (
        <PaymentContext.Provider
            value={{
                currency,
                setCurrency,
            }}
        >
            {children}
        </PaymentContext.Provider>
    );
};

export { PaymentContext, PaymentContextProvider };
