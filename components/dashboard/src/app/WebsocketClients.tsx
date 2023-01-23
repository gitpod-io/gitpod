/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useListenToWorkspacesWSMessages } from "../data/workspaces/listen-to-workspace-ws-messages";

// This component is intended to setup any app-wide websocket client subscriptions
// It doesn't render anything directly
export const WebsocketClients = () => {
    useListenToWorkspacesWSMessages();

    return null;
};
