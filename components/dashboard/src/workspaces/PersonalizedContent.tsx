/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { useEffect, useState } from "react";
import { User } from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { useCurrentUser } from "../user-context";

type ContentItem = {
    url: string;
    title: string;
    label: string;
};

const contentList: ContentItem[] = [
    {
        url: "https://www.gitpod.io/blog/writing-software-with-chopsticks-an-intro-to-vdi",
        title: "Why replace your VDI with CDE",
        label: "vdi-replacement",
    },
    {
        url: "https://www.gitpod.io/customers/luminus",
        title: "Solve python dependency issues with Gitpod",
        label: "luminus-case-study",
    },
    {
        url: "https://www.gitpod.io/blog/how-to-use-vdis-and-cdes-together",
        title: "Using VDIs and Gitpod together",
        label: "vdi-and-cde",
    },
    {
        url: "https://www.gitpod.io/blog/onboard-contractors-securely-and-quickly-using-gitpod",
        title: "Onboard contractors with Gitpod",
        label: "onboard-contractors",
    },
    {
        url: "https://www.gitpod.io/solutions/onboarding",
        title: "Onboarding developers in one click",
        label: "onboarding-solutions",
    },
    {
        url: "https://www.gitpod.io/customers/kingland",
        title: "How Gitpod impacts supply chain security",
        label: "kingland-case-study",
    },
    {
        url: "https://www.gitpod.io/blog/improve-security-using-ephemeral-development-environments",
        title: "Improve security with ephemeral environments",
        label: "ephemeral-security",
    },
    {
        url: "https://www.gitpod.io/blog/using-a-cde-roi-calculator",
        title: "Building a business case for Gitpod",
        label: "cde-roi-calculator",
    },
    {
        url: "https://www.gitpod.io/blog/whats-a-cloud-development-environment",
        title: "What's a CDE",
        label: "what-is-cde",
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
    const user: User | undefined = useCurrentUser();
    const [selectedContent, setSelectedContent] = useState<ContentItem[]>([]);

    useEffect(() => {
        const storedContentData = localStorage.getItem("personalized-content-data");
        const currentTime = new Date().getTime();

        let content: ContentItem[] = [];
        let lastShownContent: string[] = [];

        if (storedContentData) {
            try {
                const { lastTime, lastContent } = JSON.parse(storedContentData);
                const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
                const weeksPassed = Math.floor((currentTime - lastTime) / WEEK_IN_MS);
                lastShownContent = lastContent || [];

                if (weeksPassed >= 1) {
                    content = getRandomContent(contentList, 3, lastShownContent);
                } else {
                    content = getFirstWeekContent(user);
                }
            } catch (error) {
                console.error("Error parsing stored content data: ", error);
                content = getRandomContent(contentList, 3, lastShownContent);
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
    }, [user]);

    return (
        <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-pk-content-primary">Personalised for you</h3>
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
 * Week 1:
 * 1. If exploration reason is not "explore-professional" -> Show default content
 * 2. If signup goal is efficiency-collab & job role is enabling/team-lead & exploration reason is replace-remote-dev:
 *    - Show 3 specific articles related to VDI replacement, VDI and CDE, and onboarding contractors
 * 3. If signup goal is (onboarding or powerful resources) and job role is data:
 *    - Show 3 specific articles related to Python dependencies, onboarding, and Gitpod solutions
 * 4. If signup goal is powerful resources:
 *    - Show 3 specific articles related to VDI replacement, onboarding, and ROI calculator
 * 5. If signup goal is security:
 *    - Show 3 specific articles related to VDI replacement, case study, and ephemeral security
 * 6. If job role is enabling/team-lead and signup goal is security:
 *    - Show 3 specific articles related to onboarding, ROI calculator, and CDE introduction
 * 7. For all other cases -> Show default content
 *
 * After Week 1:
 * - Show random 3 articles from the entire content list
 * - Avoid repeating content shown in the previous week
 * - Update content weekly
 */

function getFirstWeekContent(user: User | undefined): ContentItem[] {
    if (!user?.profile) return defaultContent;

    const { explorationReasons, signupGoals, jobRole } = user.profile;

    if (!explorationReasons?.includes("explore-professional")) {
        return defaultContent;
    }

    let content: ContentItem[] = [];

    if (
        signupGoals?.includes("efficiency-collab") &&
        (jobRole === "enabling" || jobRole === "team-lead") &&
        explorationReasons?.includes("replace-remote-dev")
    ) {
        content.push(
            contentList.find((item) => item.label === "vdi-replacement")!,
            contentList.find((item) => item.label === "vdi-and-cde")!,
            contentList.find((item) => item.label === "onboard-contractors")!,
        );
    } else if (
        (signupGoals?.includes("onboarding") || signupGoals?.includes("powerful-resources")) &&
        jobRole === "data"
    ) {
        content.push(
            contentList.find((item) => item.label === "luminus-case-study")!,
            contentList.find((item) => item.label === "onboard-contractors")!,
            contentList.find((item) => item.label === "onboarding-solutions")!,
        );
    } else if (signupGoals?.includes("powerful-resources")) {
        content.push(
            contentList.find((item) => item.label === "vdi-replacement")!,
            contentList.find((item) => item.label === "onboarding-solutions")!,
            contentList.find((item) => item.label === "cde-roi-calculator")!,
        );
    } else if (signupGoals?.includes("security")) {
        content.push(
            contentList.find((item) => item.label === "vdi-replacement")!,
            contentList.find((item) => item.label === "kingland-case-study")!,
            contentList.find((item) => item.label === "ephemeral-security")!,
        );
    } else if ((jobRole === "enabling" || jobRole === "team-lead") && signupGoals?.includes("security")) {
        content.push(
            contentList.find((item) => item.label === "onboard-contractors")!,
            contentList.find((item) => item.label === "cde-roi-calculator")!,
            contentList.find((item) => item.label === "what-is-cde")!,
        );
    }

    return content.length > 0 ? content : defaultContent;
}

function getRandomContent(list: ContentItem[], count: number, lastShown: string[]): ContentItem[] {
    const availableContent = list.filter((item) => !lastShown.includes(item.label));
    const shuffled = availableContent.length >= count ? availableContent : list;
    return [...shuffled].sort(() => 0.5 - Math.random()).slice(0, count);
}

export default PersonalizedContent;
