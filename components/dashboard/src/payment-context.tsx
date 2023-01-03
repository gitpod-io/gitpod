/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { createContext, useState } from "react";
import { Currency } from "@gitpod/gitpod-protocol/lib/plans";

const PaymentContext = createContext<{
    currency: Currency;
    setCurrency: React.Dispatch<Currency>;
    isStudent?: boolean;
    setIsStudent: React.Dispatch<boolean>;
    isChargebeeCustomer?: boolean;
    setIsChargebeeCustomer: React.Dispatch<boolean>;
}>({
    currency: "USD",
    setCurrency: () => null,
    setIsStudent: () => null,
    setIsChargebeeCustomer: () => null,
});

const PaymentContextProvider: React.FC = ({ children }) => {
    const [currency, setCurrency] = useState<Currency>("USD");
    const [isStudent, setIsStudent] = useState<boolean>();
    const [isChargebeeCustomer, setIsChargebeeCustomer] = useState<boolean>();

    return (
        <PaymentContext.Provider
            value={{
                currency,
                setCurrency,
                isStudent,
                setIsStudent,
                isChargebeeCustomer,
                setIsChargebeeCustomer,
            }}
        >
            {children}
        </PaymentContext.Provider>
    );
};

export { PaymentContext, PaymentContextProvider };
