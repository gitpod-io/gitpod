/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useContext } from "react";
import { Redirect, useLocation } from "react-router";
import { useCurrentUser } from "./user-context";
import { FeatureFlagContext } from "./contexts/FeatureFlagContext";

const KEY_PERSONAL_SUB = "personalSubscription";
const KEY_TEAM1_SUB = "teamSubscription";
const KEY_TEAM2_SUB = "teamSubscription2";

type SubscriptionType = typeof KEY_PERSONAL_SUB | typeof KEY_TEAM1_SUB | typeof KEY_TEAM2_SUB;
type Params = { id: string; type: SubscriptionType };

function SwitchToPAYG() {
    const { switchToPAYG } = useContext(FeatureFlagContext);
    const user = useCurrentUser();
    const location = useLocation();
    const params = parseSearchParams(location.search);

    const onUpgradePlan = useCallback(() => {}, []);

    if (!switchToPAYG || !user || !params) {
        return (
            <Redirect
                to={{
                    pathname: "/workspaces",
                    state: { from: location },
                }}
            />
        );
    }

    return (
        <div className="flex flex-col mt-32 mx-auto ">
            <div className="flex flex-col max-h-screen max-w-2xl mx-auto items-center w-full">
                <h1>Switch to Pay-as-you-go</h1>
                <div className="text-gray-500 text-center text-base">Pay-as-you-go has several clear benefits. ...</div>
                <div className="text-gray-500 text-center text-base">How do you get started?</div>
                <div className="-mx-6 px-6 mt-6 w-full">{JSON.stringify(params)}</div>
                <div className="w-full flex justify-end mt-6 space-x-2 px-6">
                    <button onClick={onUpgradePlan} disabled={true}>
                        Upgrade Plan
                    </button>
                </div>
                <div></div>
            </div>
        </div>
    );
}

function parseSearchParams(search: string): Params | undefined {
    const params = new URLSearchParams(search);
    const keys = [KEY_TEAM1_SUB, KEY_TEAM2_SUB, KEY_PERSONAL_SUB];
    for (const key of keys) {
        let id = params.get(key);
        if (id) {
            return {
                type: key as any,
                id,
            };
        }
    }
}

export default SwitchToPAYG;
