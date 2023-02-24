/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { lazy, createContext, FC, useMemo, useState, useContext, Suspense } from "react";

const Confetti = lazy(() => import(/* webpackPrefetch: true */ "react-confetti"));

type ConfettiContextType = {
    isConfettiDropping: boolean;
    dropConfetti(): void;
    hideConfetti(): void;
};
const ConfettiContext = createContext<ConfettiContextType>({
    isConfettiDropping: false,
    dropConfetti: () => undefined,
    hideConfetti: () => undefined,
});

export const ConfettiContextProvider: FC = ({ children }) => {
    const [isConfettiDropping, setIsConfettiDropping] = useState(false);
    const value = useMemo(() => {
        return {
            isConfettiDropping: isConfettiDropping,
            dropConfetti: () => setIsConfettiDropping(true),
            hideConfetti: () => setIsConfettiDropping(false),
        };
    }, [isConfettiDropping]);

    return (
        <ConfettiContext.Provider value={value}>
            {children}
            {isConfettiDropping && (
                <Suspense fallback={<></>}>
                    <Confetti recycle={false} numberOfPieces={300} onConfettiComplete={value.hideConfetti} />
                </Suspense>
            )}
        </ConfettiContext.Provider>
    );
};

export const useConfetti = () => {
    return useContext(ConfettiContext);
};
