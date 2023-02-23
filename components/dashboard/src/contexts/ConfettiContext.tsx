/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { lazy, createContext, FC, useMemo, useState, useContext } from "react";

const Confetti = lazy(() => import(/* webpackPrefetch: true */ "react-confetti"));

type ConfettiContextType = {
    isConfettiShowing: boolean;
    showConfetti(): void;
    hideConfetti(): void;
};
const ConfettiContext = createContext<ConfettiContextType>({
    isConfettiShowing: false,
    showConfetti: () => undefined,
    hideConfetti: () => undefined,
});

export const ConfettiContextProvider: FC = ({ children }) => {
    const [showConfetti, setShowConfetti] = useState(false);
    const value = useMemo(() => {
        return {
            isConfettiShowing: showConfetti,
            showConfetti: () => setShowConfetti(true),
            hideConfetti: () => setShowConfetti(false),
        };
    }, [showConfetti]);

    return (
        <ConfettiContext.Provider value={value}>
            {children}
            {showConfetti && (
                <Confetti recycle={false} numberOfPieces={300} onConfettiComplete={() => setShowConfetti(false)} />
            )}
        </ConfettiContext.Provider>
    );
};

export const useConfetti = () => {
    return useContext(ConfettiContext);
};
