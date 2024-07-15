/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { useEffect, useState } from "react";
import { User } from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { useCurrentUser } from "../user-context";
import { storageAvailable } from "../utils";
import { Heading3 } from "@podkit/typography/Headings";

type ContentItem = {
    url: string;
    title: string;
    label: string;
    priority?: number;
    recommended?: {
        jobRole?: string[];
        explorationReasons?: string[];
        signupGoals?: string[];
    };
};

const contentList: ContentItem[] = [
    {
        url: "https://www.gitpod.io/blog/writing-software-with-chopsticks-an-intro-to-vdi",
        title: "Why replace a VDI with Gitpod",
        label: "vdi-replacement",
        priority: 1,
        recommended: {
            explorationReasons: ["replace-remote-dev"],
            signupGoals: ["efficiency-collab", "security"],
        },
    },
    {
        url: "https://www.gitpod.io/customers/luminus",
        title: "Solve python dependency issues with Gitpod",
        label: "luminus-case-study",
        priority: 2,
        recommended: {
            jobRole: ["data"],
        },
    },
    {
        url: "https://www.gitpod.io/blog/how-to-use-vdis-and-cdes-together",
        title: "Using VDIs and Gitpod together",
        label: "vdi-and-cde",
        priority: 3,
        recommended: {
            explorationReasons: ["replace-remote-dev"],
            signupGoals: ["security"],
        },
    },
    {
        url: "https://www.gitpod.io/blog/onboard-contractors-securely-and-quickly-using-gitpod",
        title: "Onboard contractors securely with Gitpod",
        label: "onboard-contractors",
        priority: 4,
        recommended: {
            jobRole: ["enabling", "team-lead"],
            signupGoals: ["onboarding", "security"],
        },
    },
    {
        url: "https://www.gitpod.io/solutions/onboarding",
        title: "Onboard developers in one click with Gitpod",
        label: "onboarding-solutions",
        priority: 5,
        recommended: {
            signupGoals: ["onboarding", "efficiency-collab"],
        },
    },
    {
        url: "https://www.gitpod.io/customers/kingland",
        title: "The impact of Gitpod on supply-chain security",
        label: "kingland-case-study",
        priority: 6,
        recommended: {
            signupGoals: ["security"],
        },
    },
    {
        url: "https://www.gitpod.io/blog/improve-security-using-ephemeral-development-environments",
        title: "Improve security with ephemeral environments",
        label: "ephemeral-security",
        priority: 7,
        recommended: {
            signupGoals: ["security"],
        },
    },
    {
        url: "https://www.gitpod.io/blog/using-a-cde-roi-calculator",
        title: "What is the business case for a CDE",
        label: "cde-roi-calculator",
        priority: 8,
        recommended: {
            jobRole: ["enabling", "team-lead"],
            explorationReasons: ["replace-remote-dev"],
            signupGoals: ["efficiency-collab", "security"],
        },
    },
    {
        url: "https://www.gitpod.io/blog/whats-a-cloud-development-environment",
        title: "What is a cloud development environment",
        label: "what-is-cde",
        priority: 9,
        recommended: {
            jobRole: ["enabling", "team-lead"],
        },
    },
];

const defaultContent: ContentItem[] = [
    {
        url: "https://www.gitpod.io/blog/whats-a-cloud-development-environment",
        title: "What's a CDE",
        label: "what-is-cde",
    },
    {
        url: "https://www.gitpod.io/solutions/onboarding",
        title: "Onboarding developers in one click",
        label: "onboarding-solutions",
    },
    {
        url: "https://www.gitpod.io/blog/using-a-cde-roi-calculator",
        title: "Building a business case for Gitpod",
        label: "cde-roi-calculator",
    },
];

const PersonalizedContent: React.FC = () => {
    const user = useCurrentUser();
    const [selectedContent, setSelectedContent] = useState<ContentItem[]>([]);

    useEffect(() => {
        if (!storageAvailable("localStorage")) {
            // Handle the case where localStorage is not available
            setSelectedContent(getFirstWeekContent(user));
            return;
        }

        let content: ContentItem[] = [];
        let lastShownContent: string[] = [];

        try {
            const storedContentData = localStorage.getItem("personalized-content-data");
            const currentTime = new Date().getTime();

            if (storedContentData) {
                const { lastTime, lastContent } = JSON.parse(storedContentData);
                const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
                const weeksPassed = Math.floor((currentTime - lastTime) / WEEK_IN_MS);
                lastShownContent = lastContent || [];

                if (weeksPassed >= 1) {
                    content = getRandomContent(contentList, 3, lastShownContent);
                } else {
                    content = getFirstWeekContent(user);
                }
            } else {
                content = getFirstWeekContent(user);
            }

            localStorage.setItem(
                "personalized-content-data",
                JSON.stringify({
                    lastContent: content.map((item) => item.label),
                    lastTime: currentTime,
                }),
            );

            setSelectedContent(content);
        } catch (error) {
            console.error("Error handling personalized content: ", error);
            setSelectedContent(getRandomContent(contentList, 3, []));
        }
    }, [user]);

    return (
        <div className="flex flex-col gap-2">
            <Heading3> Personalised for you </Heading3>
            <div className="flex flex-col gap-1 w-fit">
                {selectedContent.map((item, index) => (
                    <a
                        key={index}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-pk-content-primary items-center hover:text-blue-600 dark:hover:text-blue-400"
                    >
                        {item.title}
                    </a>
                ))}
            </div>
        </div>
    );
};

/**
 * Content Selection Logic:
 *
 * 1. Filter contentList based on user profile:
 *    - Match jobRole if specified
 *    - Match any explorationReasons if specified
 *    - Match any signupGoals if specified
 * 2. Sort matched content by priority (lower number = higher priority)
 * 3. Select top 3 items from matched content
 * 4. If less than 3 items selected:
 *    - Fill remaining slots with unique items from defaultContent
 * 5. If no matches found:
 *    - Show default content
 *
 * After Week 1:
 * - Show random 3 articles from the entire content list
 * - Avoid repeating content shown in the previous week
 * - Update content weekly
 */

function getFirstWeekContent(user: User | undefined): ContentItem[] {
    if (!user?.profile) return defaultContent;

    const { explorationReasons, signupGoals, jobRole } = user.profile;

    const matchingContent = contentList.filter((item) => {
        const rec = item.recommended;
        if (!rec) return false;

        const jobRoleMatch = !rec.jobRole || rec.jobRole.includes(jobRole);
        const reasonsMatch =
            !rec.explorationReasons || rec.explorationReasons.some((r) => explorationReasons?.includes(r));
        const goalsMatch = !rec.signupGoals || rec.signupGoals.some((g) => signupGoals?.includes(g));

        return jobRoleMatch && reasonsMatch && goalsMatch;
    });

    const sortedContent = matchingContent.sort((a, b) => (a.priority || Infinity) - (b.priority || Infinity));

    let selectedContent = sortedContent.slice(0, 3);

    if (selectedContent.length < 3) {
        const remainingCount = 3 - selectedContent.length;
        const selectedLabels = new Set(selectedContent.map((item) => item.label));

        const additionalContent = defaultContent
            .filter((item) => !selectedLabels.has(item.label))
            .slice(0, remainingCount);

        selectedContent = [...selectedContent, ...additionalContent];
    }

    return selectedContent;
}

function getRandomContent(list: ContentItem[], count: number, lastShown: string[]): ContentItem[] {
    const availableContent = list.filter((item) => !lastShown.includes(item.label));
    const shuffled = availableContent.length >= count ? availableContent : list;
    return [...shuffled].sort(() => 0.5 - Math.random()).slice(0, count);
}

export default PersonalizedContent;
