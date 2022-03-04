/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import Modal from "../components/Modal";
import { WhatsNewEntry202104 } from "./WhatsNew-2021-04";
import { WhatsNewEntry202106 } from "./WhatsNew-2021-06";
import { UserContext } from "../user-context";
import { useContext, useState } from "react";
import { getGitpodService } from "../service/service";

const allEntries: WhatsNewEntry[] = [
    WhatsNewEntry202106,
    WhatsNewEntry202104,
]

export const shouldSeeWhatsNew = (user: User, news: { newsKey: string, maxUserCreationDate: string }[] = allEntries) => {
    const whatsNewSeen = user?.additionalData?.whatsNewSeen;
    return news.some(x => user.creationDate <= x.maxUserCreationDate && (!whatsNewSeen || !whatsNewSeen[x.newsKey]));
}

export function WhatsNew(props: { onClose: () => void }) {
    const { user, setUser } = useContext(UserContext);

    const _unseenEntries = allEntries.filter(x => user && shouldSeeWhatsNew(user, [x])) || [];
    const [visibleEntry, setVisibleEntry] = useState(_unseenEntries.pop());
    const [unseenEntries, setUnseenEntries] = useState(_unseenEntries);

    const markAsSeen = async (user?: User, ...news: (WhatsNewEntry | undefined)[]) => {
        if (!user) {
            return;
        }

        for (const n of news.filter(x => x && x.actionAfterSeen)) {
            user = await n!.actionAfterSeen!(user);
        };

        const additionalData = user.additionalData = user.additionalData || {};
        additionalData.whatsNewSeen = additionalData.whatsNewSeen || {};
        const now = new Date().toISOString();
        for (const newsKey of (news.filter(x => x !== undefined) as WhatsNewEntry[]).map(x => x.newsKey)) {
            additionalData.whatsNewSeen[newsKey] = now;
        }
        user = await getGitpodService().server.updateLoggedInUser({
            additionalData
        });
        setUser(user);
    };

    const internalClose = async () => {
        await markAsSeen(user, ...unseenEntries, visibleEntry);
        props.onClose();
    };

    const hasNext = () => unseenEntries.length > 0;

    const next = async () => {
        if (unseenEntries.length === 0) {
            return;
        }
        visibleEntry && await markAsSeen(user, visibleEntry);
        const _unseenEntries = unseenEntries;
        setVisibleEntry(_unseenEntries.pop());
        setUnseenEntries(_unseenEntries);
    };

    return <Modal
        visible={!!visibleEntry}
        onClose={internalClose}
    >
        <h3 className="pb-4">What's New 🎁</h3>
        <>{visibleEntry && user ? visibleEntry.children(user, setUser) : <></>}</>
        {
            hasNext() ?
                <>
                    <div className="flex items-center justify-end mt-6 space-x-2">
                        <div className="text-sm mr-auto italic">{unseenEntries.length} more update{unseenEntries.length > 1 ? "s" : ""}</div>
                        <button className="ml-2 secondary" onClick={internalClose}>Dismiss All</button>
                        <button className="ml-2" onClick={next}>Next</button>
                    </div>
                </>
                :
                <div className="flex justify-end mt-6 space-x-2">
                    <button onClick={internalClose}>Continue</button>
                </div>
        }
    </Modal>
}

export interface WhatsNewEntry {
    newsKey: string,
    maxUserCreationDate: string,
    children: (user: User, setUser: React.Dispatch<User>) => React.ReactChild[] | React.ReactChild,
    actionAfterSeen?: (user: User) => Promise<User>;
}
