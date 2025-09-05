/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import Alert, { AlertType } from "./components/Alert";
import { useUserLoader } from "./hooks/use-user-loader";
import { isGitpodIo } from "./utils";
import { trackEvent } from "./Analytics";
import { useUpdateCurrentUserMutation } from "./data/current-user/update-mutation";
import { User as UserProtocol } from "@gitpod/gitpod-protocol";
import { User } from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { useCurrentOrg } from "./data/organizations/orgs-query";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { getGitpodService } from "./service/service";
import { useOrgBillingMode } from "./data/billing-mode/org-billing-mode-query";
import { Organization } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { MaintenanceModeBanner } from "./org-admin/MaintenanceModeBanner";
import { MaintenanceNotificationBanner } from "./org-admin/MaintenanceNotificationBanner";
import { useToast } from "./components/toasts/Toasts";
import { getPrimaryEmail } from "@gitpod/public-api-common/lib/user-utils";
import onaWordmark from "./images/ona-wordmark.svg";

const KEY_APP_DISMISSED_NOTIFICATIONS = "gitpod-app-notifications-dismissed";
const PRIVACY_POLICY_LAST_UPDATED = "2025-09-01";

interface Notification {
    id: string;
    type: AlertType;
    message: JSX.Element;
    preventDismiss?: boolean;
    onClose?: () => void;
}

const UPDATED_PRIVACY_POLICY = (updateUser: (user: Partial<UserProtocol>) => Promise<User>) => {
    return {
        id: "privacy-policy-update",
        type: "info",
        preventDismiss: true,
        onClose: async () => {
            let dismissSuccess = false;
            try {
                const updatedUser = await updateUser({
                    additionalData: { profile: { acceptedPrivacyPolicyDate: dayjs().toISOString() } },
                });
                dismissSuccess = !!updatedUser;
            } catch (err) {
                console.error("Failed to update user's privacy policy acceptance date", err);
                dismissSuccess = false;
            } finally {
                trackEvent("privacy_policy_update_accepted", {
                    path: window.location.pathname,
                    success: dismissSuccess,
                });
            }
        },
        message: (
            <span className="text-md">
                We've updated our Privacy Policy. You can review it{" "}
                <a className="gp-link" href="https://www.gitpod.io/privacy" target="_blank" rel="noreferrer">
                    here
                </a>
                .
            </span>
        ),
    } as Notification;
};

const GITPOD_FLEX_INTRODUCTION_COACHMARK_KEY = "gitpod_flex_introduction";
const GITPOD_FLEX_INTRODUCTION = (updateUser: (user: Partial<UserProtocol>) => Promise<User>) => {
    return {
        id: GITPOD_FLEX_INTRODUCTION_COACHMARK_KEY,
        type: "info",
        preventDismiss: true,
        onClose: async () => {
            let dismissSuccess = false;
            try {
                const updatedUser = await updateUser({
                    additionalData: {
                        profile: {
                            coachmarksDismissals: {
                                [GITPOD_FLEX_INTRODUCTION_COACHMARK_KEY]: new Date().toISOString(),
                            },
                        },
                    },
                });
                dismissSuccess = !!updatedUser;
            } catch (err) {
                dismissSuccess = false;
            } finally {
                trackEvent("coachmark_dismissed", {
                    name: "gitpod-flex-introduction",
                    success: dismissSuccess,
                });
            }
        },
        message: (
            <span className="text-md">
                <b>Introducing Gitpod Flex:</b> self-host for free in 3 min or run locally using Gitpod Desktop |{" "}
                <a className="text-kumquat-ripe" href="https://app.gitpod.io" target="_blank" rel="noreferrer">
                    Try now
                </a>
            </span>
        ),
    } as Notification;
};

const INVALID_BILLING_ADDRESS = (stripePortalUrl: string | undefined) => {
    return {
        id: "invalid-billing-address",
        type: "warning",
        preventDismiss: true,
        message: (
            <span className="text-md">
                Invalid billing address: tax calculations may be affected. Ensure your address includes Country, City,
                State, and Zip code. Update your details{" "}
                <a
                    href={`${stripePortalUrl}/customer/update`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gp-link"
                >
                    here
                </a>
                .
            </span>
        ),
    } as Notification;
};

const GITPOD_CLASSIC_SUNSET = (
    user: User | undefined,
    toast: any,
    onaClicked: boolean,
    handleOnaBannerClick: () => void,
) => {
    return {
        id: "gitpod-classic-sunset",
        type: "info" as AlertType,
        message: (
            <span className="text-md text-white font-semibold items-center justify-center">
                <img src={onaWordmark} alt="Ona" className="inline align-middle w-12 mb-0.5" draggable="false" /> |
                parallel SWE agents in the cloud, sandboxed for high-autonomy.{" "}
                <a href="https://app.ona.com" target="_blank" rel="noreferrer" className="underline hover:no-underline">
                    Start for free
                </a>{" "}
                and get $100 credits. Gitpod Classic sunsets Oct 15 |{" "}
                <a
                    href="https://ona.com/stories/gitpod-classic-payg-sunset"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:no-underline"
                >
                    Learn more
                </a>
            </span>
        ),
    } as Notification;
};

export function AppNotifications() {
    const [topNotification, setTopNotification] = useState<Notification | undefined>(undefined);
    const [onaClicked, setOnaClicked] = useState(false);
    const { user, loading } = useUserLoader();
    const { mutateAsync } = useUpdateCurrentUserMutation();
    const { toast } = useToast();

    const currentOrg = useCurrentOrg().data;
    const { data: billingMode } = useOrgBillingMode();

    useEffect(() => {
        const storedOnaData = localStorage.getItem("ona-banner-data");
        if (storedOnaData) {
            const { clicked } = JSON.parse(storedOnaData);
            setOnaClicked(clicked || false);
        }
    }, []);

    const handleOnaBannerClick = useCallback(() => {
        const userEmail = user ? getPrimaryEmail(user) || "" : "";
        trackEvent("waitlist_joined", { email: userEmail, feature: "Ona" });

        setOnaClicked(true);
        const existingData = localStorage.getItem("ona-banner-data");
        const parsedData = existingData ? JSON.parse(existingData) : {};
        localStorage.setItem("ona-banner-data", JSON.stringify({ ...parsedData, clicked: true }));

        toast(
            <div>
                <div className="font-medium">You're on the waitlist</div>
                <div className="text-sm opacity-80">We'll reach out to you soon.</div>
            </div>,
        );
    }, [user, toast]);

    useEffect(() => {
        let ignore = false;

        const updateNotifications = async () => {
            const notifications = [];
            if (!loading) {
                if (isGitpodIo()) {
                    notifications.push(GITPOD_CLASSIC_SUNSET(user, toast, onaClicked, handleOnaBannerClick));
                }

                if (
                    isGitpodIo() &&
                    (!user?.profile?.acceptedPrivacyPolicyDate ||
                        new Date(PRIVACY_POLICY_LAST_UPDATED) > new Date(user.profile.acceptedPrivacyPolicyDate))
                ) {
                    notifications.push(UPDATED_PRIVACY_POLICY((u: Partial<UserProtocol>) => mutateAsync(u)));
                }

                if (isGitpodIo() && currentOrg && billingMode?.mode === "usage-based") {
                    const notification = await checkForInvalidBillingAddress(currentOrg);
                    if (notification) {
                        notifications.push(notification);
                    }
                }

                if (isGitpodIo() && !user?.profile?.coachmarksDismissals[GITPOD_FLEX_INTRODUCTION_COACHMARK_KEY]) {
                    notifications.push(GITPOD_FLEX_INTRODUCTION((u: Partial<UserProtocol>) => mutateAsync(u)));
                }
            }

            if (!ignore) {
                const dismissedNotifications = getDismissedNotifications();
                const topNotification = notifications.find((n) => !dismissedNotifications.includes(n.id));
                setTopNotification(topNotification);
            }
        };
        updateNotifications();

        return () => {
            ignore = true;
        };
    }, [loading, mutateAsync, user, currentOrg, billingMode, onaClicked, handleOnaBannerClick, toast]);

    const dismissNotification = useCallback(() => {
        if (!topNotification) {
            return;
        }

        const dismissedNotifications = getDismissedNotifications();
        dismissedNotifications.push(topNotification.id);
        setDismissedNotifications(dismissedNotifications);
        setTopNotification(undefined);
    }, [topNotification, setTopNotification]);

    return (
        <div className="app-container pt-2">
            <MaintenanceModeBanner />
            <MaintenanceNotificationBanner />
            {topNotification && (
                <Alert
                    type={topNotification.type}
                    closable={true}
                    onClose={() => {
                        if (!topNotification.preventDismiss) {
                            dismissNotification();
                        } else {
                            if (topNotification.onClose) {
                                topNotification.onClose();
                            }
                        }
                    }}
                    showIcon={true}
                    className={`flex rounded mb-2 w-full ${
                        topNotification.id === "gitpod-classic-sunset"
                            ? "bg-[linear-gradient(to_left,#1F1329_0%,#333A75_20%,#556CA8_40%,#90A898_60%,#E2B15C_80%,#E2B15C_97%,#BEA462_100%)]"
                            : ""
                    }`}
                >
                    <span>{topNotification.message}</span>
                </Alert>
            )}
        </div>
    );
}

async function checkForInvalidBillingAddress(org: Organization): Promise<Notification | undefined> {
    try {
        const attributionId = AttributionId.render(AttributionId.createFromOrganizationId(org.id));

        const subscriptionId = await getGitpodService().server.findStripeSubscriptionId(attributionId);
        if (!subscriptionId) {
            return undefined;
        }

        const invalidBillingAddress = await getGitpodService().server.isCustomerBillingAddressInvalid(attributionId);
        if (!invalidBillingAddress) {
            return undefined;
        }

        const stripePortalUrl = await getGitpodService().server.getStripePortalUrl(attributionId);
        return INVALID_BILLING_ADDRESS(stripePortalUrl);
    } catch (err) {
        // On error we don't want to block but still would like to report against metrics
        console.debug("failed to determine 'invalid billing address' state", err);
        return undefined;
    }
}

function getDismissedNotifications(): string[] {
    try {
        const str = window.localStorage.getItem(KEY_APP_DISMISSED_NOTIFICATIONS);
        const parsed = JSON.parse(str || "[]");
        if (!Array.isArray(parsed)) {
            window.localStorage.removeItem(KEY_APP_DISMISSED_NOTIFICATIONS);
            return [];
        }
        return parsed;
    } catch (err) {
        console.debug("Failed to parse dismissed notifications", err);
        window.localStorage.removeItem(KEY_APP_DISMISSED_NOTIFICATIONS);
        return [];
    }
}

function setDismissedNotifications(ids: string[]) {
    try {
        window.localStorage.setItem(KEY_APP_DISMISSED_NOTIFICATIONS, JSON.stringify(ids));
    } catch (err) {
        console.debug("Failed to set dismissed notifications", err);
        window.localStorage.removeItem(KEY_APP_DISMISSED_NOTIFICATIONS);
    }
}
