/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { useEffect, useState } from "react";
import { trackEvent } from "../Analytics";
import { useCurrentUser } from "../user-context";
import { getPrimaryEmail } from "@gitpod/public-api-common/lib/user-utils";
import { useToast } from "../components/toasts/Toasts";
import onaWordmark from "../images/ona-wordmark.svg";

const onaBanner = {
    type: "Introducing",
    title: "ONA",
    subtitle: "Parallel SWE agents in the cloud, sandboxed for high-autonomy.",
    ctaText: "Get early access",
    learnMoreText: "Learn more",
    link: "https://ona.com/stories/gitpod-classic-payg-sunset",
};

export const OnaBanner: React.FC = () => {
    const [onaClicked, setOnaClicked] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const user = useCurrentUser();
    const { toast } = useToast();

    useEffect(() => {
        const storedOnaData = localStorage.getItem("workspaces-ona-banner-data");

        // Check Ona banner state
        if (storedOnaData) {
            const { clicked, dismissed } = JSON.parse(storedOnaData);
            setOnaClicked(clicked || false);
            setIsDismissed(dismissed || false);
        }

        // Clean up old blog banner data
        localStorage.removeItem("blog-banner-data");
    }, []);

    const handleOnaBannerClick = () => {
        if (!onaClicked) {
            // Track "Get early access" click
            const userEmail = user ? getPrimaryEmail(user) || "" : "";
            trackEvent("waitlist_joined", { email: userEmail, feature: "Ona" });

            setOnaClicked(true);
            localStorage.setItem(
                "workspaces-ona-banner-data",
                JSON.stringify({ clicked: true, dismissed: isDismissed }),
            );

            // Also set the global ona-banner-data clicked state (preserve existing dismissed state)
            const existingOnaData = localStorage.getItem("ona-banner-data");
            const existingDismissed = existingOnaData ? JSON.parse(existingOnaData).dismissed || false : false;
            localStorage.setItem("ona-banner-data", JSON.stringify({ clicked: true, dismissed: existingDismissed }));

            // Show success toast
            toast(
                <div>
                    <div className="font-medium">You're on the waitlist</div>
                    <div className="text-sm opacity-80">We'll reach out to you soon.</div>
                </div>,
            );
        } else {
            // "Learn more" click - open link
            window.open(onaBanner.link, "_blank", "noopener,noreferrer");
        }
    };

    const handleDismiss = () => {
        setIsDismissed(true);
        localStorage.setItem("workspaces-ona-banner-data", JSON.stringify({ clicked: onaClicked, dismissed: true }));
    };

    // Don't render if dismissed
    if (isDismissed) {
        return null;
    }

    return (
        <div className="flex flex-col gap-4">
            <div
                className="relative rounded-lg overflow-hidden flex flex-col gap-4 text-white max-w-[320px] p-6"
                style={{
                    background:
                        "linear-gradient(340deg, #1F1329 0%, #333A75 20%, #556CA8 40%, #90A898 60%, #E2B15C 80%, #BEA462 100%)",
                }}
            >
                {/* Close button */}
                <button
                    onClick={handleDismiss}
                    className="absolute top-4 right-4 text-white/70 hover:text-white w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                    aria-label="Dismiss banner"
                >
                    ✕
                </button>

                {/* Content */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-lg font-normal">
                        {onaBanner.type}
                        <img src={onaWordmark} alt="ONA" className="w-16" draggable="false" />
                    </div>
                    <div className="text-base font-normal opacity-90">{onaBanner.subtitle}</div>
                </div>

                {/* CTA Button */}
                <button
                    onClick={handleOnaBannerClick}
                    className="bg-white/20 backdrop-blur-sm text-white font-medium py-1 px-6 rounded-full hover:bg-white/30 transition-colors border border-white/20 max-w-[180px]"
                >
                    {onaClicked ? onaBanner.learnMoreText : onaBanner.ctaText}
                </button>
            </div>
        </div>
    );
};

// Export with old name for backward compatibility
export const BlogBanners = OnaBanner;
