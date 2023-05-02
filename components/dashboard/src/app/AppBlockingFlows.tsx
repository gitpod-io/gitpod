/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, lazy } from "react";
import { useCheckDedicatedSetup } from "../dedicated-setup/use-check-dedicated-setup";
import { useCurrentUser } from "../user-context";
import { MigrationPage, useShouldSeeMigrationPage } from "../whatsnew/MigrationPage";
import { useShowUserOnboarding } from "../onboarding/use-show-user-onboarding";

const UserOnboarding = lazy(() => import(/* webpackPrefetch: true */ "../onboarding/UserOnboarding"));
const DedicatedSetup = lazy(() => import(/* webpackPrefetch: true */ "../dedicated-setup/DedicatedSetup"));

// This component handles any flows that should come after we've loaded the user/orgs, but before we render the normal app chrome.
// Since this runs before the app is rendered, we should avoid adding any lengthy async calls that would delay the app from loading.
export const AppBlockingFlows: FC = ({ children }) => {
    const user = useCurrentUser();
    const shouldSeeMigrationPage = useShouldSeeMigrationPage();
    const checkDedicatedSetup = useCheckDedicatedSetup();
    const showUserOnboarding = useShowUserOnboarding();

    // This shouldn't happen, but if it does don't render anything yet
    if (!user) {
        return <></>;
    }

    // If orgOnlyAttribution is enabled and the user hasn't been migrated, yet, we need to show the migration page
    if (shouldSeeMigrationPage) {
        return <MigrationPage />;
    }

    // Handle dedicated onboarding if necessary
    if (!checkDedicatedSetup.isLoading && checkDedicatedSetup.needsOnboarding) {
        return <DedicatedSetup />;
    }

    // New user onboarding flow
    if (showUserOnboarding) {
        return <UserOnboarding user={user} />;
    }

    return <>{children}</>;
};
