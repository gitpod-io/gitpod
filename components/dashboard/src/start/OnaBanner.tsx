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
import onaApplication from "../images/ona-application.webp";

const onaBanner = {
    type: "Introducing",
    title: "ONA",
    subtitle: "The privacy-first software engineering agent.",
    ctaText: "Get early access",
    learnMoreText: "Learn more",
    link: "https://www.gitpod.io/solutions/ai",
};

interface OnaBannerProps {
    compact?: boolean;
}

export const OnaBanner: React.FC<OnaBannerProps> = ({ compact = false }) => {
    const [onaClicked, setOnaClicked] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const user = useCurrentUser();
    const { toast } = useToast();

    useEffect(() => {
        const storedOnaData = localStorage.getItem("ona-banner-data");

        if (storedOnaData) {
            const { clicked, dismissed } = JSON.parse(storedOnaData);
            setOnaClicked(clicked || false);
            setIsDismissed(dismissed || false);
        }
    }, []);

    const handleOnaBannerClick = () => {
        // Track "Get early access" click
        const userEmail = user ? getPrimaryEmail(user) || "" : "";
        trackEvent("waitlist_joined", { email: userEmail, feature: "Ona" });

        setOnaClicked(true);
        localStorage.setItem("ona-banner-data", JSON.stringify({ clicked: true, dismissed: isDismissed }));

        // Show success toast
        toast(
            <div>
                <div className="font-medium">You're on the waitlist</div>
                <div className="text-sm opacity-80">We'll reach out to you soon.</div>
            </div>,
        );
    };

    const handleDismiss = () => {
        setIsDismissed(true);
        localStorage.setItem("ona-banner-data", JSON.stringify({ clicked: onaClicked, dismissed: true }));
    };

    // Don't render if dismissed
    if (isDismissed) {
        return null;
    }

    if (compact) {
        return (
            <div
                className="relative rounded-lg hidden lg:flex flex-col gap-3 text-white max-w-80 p-4 shadow-lg"
                style={{
                    background:
                        "linear-gradient(340deg, #1F1329 0%, #333A75 20%, #556CA8 40%, #90A898 60%, #E2B15C 80%, #BEA462 100%)",
                }}
            >
                {/* Close button */}
                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 text-white/70 hover:text-white w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                    aria-label="Dismiss banner"
                >
                    ✕
                </button>

                {/* Compact layout */}
                <div classNameo="flex items-center gap-2 text-sm font-normal">
                    {onaBanner.type}
                    <img src={onaWordmark} alt="ONA" className="w-12" draggable="false" />
                </div>

                <p className="text-white !text-lg font-bold leading-tight">
                    The privacy-first software engineering agent
                </p>

                {!onaClicked ? (
                    <button
                        onClick={handleOnaBannerClick}
                        className="bg-white/20 backdrop-blur-sm text-white font-medium py-1.5 px-4 rounded-full hover:bg-white/30 transition-colors border border-white/20 inline-flex items-center gap-2 text-sm w-fit"
                    >
                        {onaBanner.ctaText}
                        <span className="font-bold">→</span>
                    </button>
                ) : (
                    <a
                        href={onaBanner.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white/20 backdrop-blur-sm text-white font-medium py-1.5 px-4 rounded-full hover:bg-white/30 transition-colors border border-white/20 inline-flex items-center gap-2 text-sm w-fit"
                    >
                        {onaBanner.learnMoreText}
                        <span className="font-bold">→</span>
                    </a>
                )}
            </div>
        );
    }

    return (
        <div
            className="relative rounded-lg flex flex-col lg:flex-row gap-4 lg:gap-6 text-white max-w-5xl mx-auto p-4 lg:p-6 my-4"
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

            {/* Left section - ONA branding and image */}
            <div className="flex-1 max-w-full lg:max-w-[330px] order-2 lg:order-1">
                <div className="relative bg-white/10 backdrop-blur-sm rounded-lg pt-4 px-4 lg:px-6 lg:pt-6 ">
                    {/* ONA Logo prominently displayed */}
                    <div className="flex justify-center -mb-4 lg:-mb-6">
                        <img src={onaWordmark} alt="ONA" className="w-20 lg:w-24" draggable="false" />
                    </div>

                    {/* Application screenshot */}
                    <div className="relative overflow-hidden">
                        <img
                            src={onaApplication}
                            alt="Ona application preview"
                            className="w-full translate-y-16 rounded-lg shadow-lg"
                            draggable="false"
                        />
                    </div>
                </div>
            </div>

            {/* Right section - Text content and CTA */}
            <div className="flex-1 max-w-[500px] lg:max-w-[550px] order-1 lg:order-2 lg:ml-8 text-left">
                <div className="max-lg:mt-2 space-y-3 lg:space-y-4">
                    {/* Main title */}
                    <h2 className="text-white text-lg sm:text-xl font-bold leading-tight">
                        The privacy-first software engineering agent
                    </h2>

                    {/* Description */}
                    <div className="space-y-2 lg:space-y-3">
                        <p className="text-[#FFFFFF99] text-base leading-relaxed">
                            Delegate software tasks to Ona. It writes code, runs tests, and opens a pull request. Or
                            jump in to inspect output or pair program in your IDE.
                        </p>
                        <p className="text-[#FFFFFF99] text-base leading-relaxed">
                            Ona runs inside your infrastructure (VPC), with full audit trails, zero data exposure, and
                            support for any LLM.
                        </p>
                    </div>

                    {/* CTA Button */}
                    <div className="pt-2 mb-4">
                        {!onaClicked ? (
                            <button
                                onClick={handleOnaBannerClick}
                                className="inline-flex items-center justify-center gap-2 bg-[#fdfdfd] text-[#12100C] px-4 lg:px-6 py-2 rounded-[14px] text-sm transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-md hover:bg-[#F5F4F3] font-medium"
                            >
                                <span>{onaBanner.ctaText}</span>
                                <span className="font-bold">→</span>
                            </button>
                        ) : (
                            <a
                                href={onaBanner.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 bg-[#fdfdfd] text-[#12100C] px-4 lg:px-6 py-2 rounded-[14px] text-sm transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-md hover:bg-[#F5F4F3] font-medium"
                            >
                                <span>{onaBanner.learnMoreText}</span>
                                <span className="font-bold">→</span>
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
