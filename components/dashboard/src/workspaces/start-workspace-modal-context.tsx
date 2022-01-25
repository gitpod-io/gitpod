/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React, { createContext, useEffect, useState } from 'react';

export const StartWorkspaceModalContext = createContext<{
    isStartWorkspaceModalVisible?: boolean,
    setIsStartWorkspaceModalVisible: React.Dispatch<boolean>,
}>({
    setIsStartWorkspaceModalVisible: () => null,
});

export const StartWorkspaceModalContextProvider: React.FC = ({ children }) => {
    const [ isStartWorkspaceModalVisible, setIsStartWorkspaceModalVisible ] = useState<boolean>(false);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'o') {
                event.preventDefault();
                setIsStartWorkspaceModalVisible(true);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        }
    }, []);

    return <StartWorkspaceModalContext.Provider value={{ isStartWorkspaceModalVisible, setIsStartWorkspaceModalVisible }}>
        {children}
    </StartWorkspaceModalContext.Provider>;
}

export const StartWorkspaceModalKeyBinding = `${/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform) ? '⌘' : 'Ctrl+'}O`;