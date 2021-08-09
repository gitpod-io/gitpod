/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { WhatsNewEntry } from "./WhatsNew";
import { switchToVSCodeAction } from "./WhatsNew-2021-04";
import PillLabel from "../components/PillLabel";

export const WhatsNewEntry202108: WhatsNewEntry = {
    children: (user: User, setUser: React.Dispatch<User>) => {

        return <>
            <div className="border-t border-b border-gray-200 dark:border-gray-800 -mx-6 px-6 pt-6 pb-4">
                <p className="pb-2 text-gray-900 dark:text-gray-100 text-base font-medium">Teams & Projects <PillLabel>New Feature</PillLabel></p>
                <p className="pb-2 text-gray-500 dark:text-gray-400 text-sm">Hey! We're introducing <strong>Teams & Projects</strong> to surface <strong>Prebuilds</strong> in the dashboard. All existing teams will be migrated over the upcoming weeks. No action is required on your side. 🎉</p>
                <p className="pb-2 text-gray-500 dark:text-gray-400 text-sm">You can create as many teams as you need and import repositories as projects from the top navigation. 💡</p>
                <p className="pb-2 text-gray-500 dark:text-gray-400 text-sm">We welcome any input on this first iteration in <a href="/new" className="learn-more">the feedback issue</a>. 📝</p>
            </div>
        </>;
    },
    newsKey: 'August-2021',
    maxUserCreationDate: '2021-08-17',
    actionAfterSeen: switchToVSCodeAction,
};
