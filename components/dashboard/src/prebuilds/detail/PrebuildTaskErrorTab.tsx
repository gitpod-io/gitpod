/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TabsContent } from "@podkit/tabs/Tabs";
import { PropsWithChildren } from "react";
import { Text } from "@podkit/typography/Text";

type Props = {
    taskId?: string;
};
export const PrebuildTaskErrorTab = ({ taskId, children }: PropsWithChildren<Props>) => {
    return (
        <TabsContent value={taskId ?? "empty-tab"} className="h-112 mt-0 border-pk-border-base">
            <div className="px-6 py-4 h-full w-full bg-pk-surface-primary text-base flex items-center justify-center">
                <Text className="w-80 text-center">{children}</Text>
            </div>
        </TabsContent>
    );
};
