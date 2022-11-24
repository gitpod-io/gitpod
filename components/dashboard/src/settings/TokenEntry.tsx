/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PersonalAccessToken } from "@gitpod/public-api/lib/gitpod/experimental/v1/tokens_pb";

function TokenEntry(t: { token: PersonalAccessToken }) {
    if (!t) {
        return <></>;
    }
    return (
        <div className="rounded-xl whitespace-nowrap flex space-x-2 py-6 px-6 w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gitpod-kumquat-light group">
            <div className="pr-3 self-center w-1/12">
                <span>{t.token.name || ""}</span>
            </div>
            <div className="flex flex-col w-6/12">
                <span>{t.token.scopes || ""}</span>
            </div>
            <div className="flex w-5/12 self-center">
                <span>{t.token.expirationTime || ""}</span>
            </div>
        </div>
    );
}

export default TokenEntry;
