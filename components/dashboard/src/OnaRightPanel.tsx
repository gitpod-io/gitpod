/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { useState, useEffect } from "react";
import { trackEvent } from "./Analytics";
import { useCurrentUser } from "./user-context";
import { getPrimaryEmail } from "@gitpod/public-api-common/lib/user-utils";
import { useToast } from "./components/toasts/Toasts";
import onaWordmark from "./images/ona-wordmark.svg";
import onaApplication from "./images/ona-application.webp";

export const OnaRightPanel = () => {
    const [email, setEmail] = useState("");
    const [isSubmitted, setIsSubmitted] = useState(false);
    const user = useCurrentUser();
    const { toast } = useToast();

    useEffect(() => {
        const storedOnaData = localStorage.getItem("ona-waitlist-data");
        if (storedOnaData) {
            const { submitted } = JSON.parse(storedOnaData);
            setIsSubmitted(submitted || false);
        }
    }, []);

    const handleEmailSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;

        const userEmail = user ? getPrimaryEmail(user) || email : email;
        trackEvent("waitlist_joined", { email: userEmail, feature: "Ona" });

        setIsSubmitted(true);
        localStorage.setItem("ona-waitlist-data", JSON.stringify({ submitted: true }));

        toast(
            <div>
                <div className="font-medium">You're on the waitlist</div>
                <div className="text-sm opacity-80">We'll reach out to you soon.</div>
            </div>,
        );
    };

    return (
        <div className="w-full lg:w-1/3 flex flex-col justify-center p-4 lg:p-6 md:min-h-screen">
            <div
                className="rounded-lg flex flex-col gap-6 text-white p-6 h-full max-w-md mx-auto w-full"
                style={{
                    background:
                        "linear-gradient(340deg, #1F1329 0%, #333A75 20%, #556CA8 40%, #90A898 60%, #E2B15C 80%, #BEA462 100%)",
                }}
            >
                <div className="flex justify-center pt-4">
                    <img src={onaWordmark} alt="ONA" className="w-32" draggable="false" />
                </div>

                <div className="relative bg-white/10 backdrop-blur-sm rounded-lg p-4 -mt-2">
                    <img
                        src={onaApplication}
                        alt="Ona application preview"
                        className="w-full h-auto rounded-lg shadow-lg"
                        draggable="false"
                    />
                </div>

                <div className="flex flex-col gap-4 flex-1">
                    <h2 className="text-white text-xl font-bold leading-tight text-center">
                        Ona - parallel SWE agents in the cloud, sandboxed for high-autonomy.{" "}
                        <a
                            href="https://app.ona.com"
                            target="_blank"
                            rel="noreferrer"
                            className="underline hover:no-underline"
                        >
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
                    </h2>

                    <div className="space-y-3 text-sm text-white/90 leading-relaxed">
                        <p>
                            Delegate software tasks to Ona. It writes code, runs tests, and opens a pull request. Or
                            jump in to inspect output or pair program in your IDE.
                        </p>
                        <p>
                            Ona runs inside your infrastructure (VPC), with full audit trails, zero data exposure, and
                            support for any LLM.
                        </p>
                    </div>

                    <div className="mt-auto pt-4">
                        {!isSubmitted ? (
                            <form onSubmit={handleEmailSubmit} className="space-y-3">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your work email"
                                    className="w-full px-4 py-2.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 text-sm"
                                    required
                                />
                                <button
                                    type="submit"
                                    className="w-full bg-white text-gray-900 font-medium py-2.5 px-4 rounded-lg hover:bg-gray-100 transition-colors text-sm inline-flex items-center justify-center gap-2"
                                >
                                    Request access
                                    <span className="font-bold">→</span>
                                </button>
                            </form>
                        ) : (
                            <button
                                onClick={() =>
                                    window.open("https://www.gitpod.io/solutions/ai", "_blank", "noopener,noreferrer")
                                }
                                className="w-full bg-white/20 backdrop-blur-sm text-white font-medium py-2.5 px-4 rounded-lg hover:bg-white/30 transition-colors border border-white/20 inline-flex items-center justify-center gap-2 text-sm"
                            >
                                Learn more
                                <span className="font-bold">→</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
