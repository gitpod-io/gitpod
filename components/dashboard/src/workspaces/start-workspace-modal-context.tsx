/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { createContext, useEffect, useState } from "react";
import { StartWorkspaceModalProps } from "./StartWorkspaceModal";

export const StartWorkspaceModalContext = createContext<{
    startWorkspaceModalProps?: StartWorkspaceModalProps;
    setStartWorkspaceModalProps: React.Dispatch<StartWorkspaceModalProps | undefined>;
}>({
    setStartWorkspaceModalProps: () => null,
});

export const StartWorkspaceModalContextProvider: React.FC = ({ children }) => {
    const [startWorkspaceModalProps, setStartWorkspaceModalProps] = useState<StartWorkspaceModalProps | undefined>(
        undefined,
    );

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "o") {
                event.preventDefault();
                setStartWorkspaceModalProps({
                    onClose: () => setStartWorkspaceModalProps(undefined),
                });
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, []);

    return (
        <StartWorkspaceModalContext.Provider value={{ startWorkspaceModalProps, setStartWorkspaceModalProps }}>
            {children}
        </StartWorkspaceModalContext.Provider>
    );
};

export const StartWorkspaceModalKeyBinding = `${/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform) ? "⌘" : "Ctrl﹢"}O`;
