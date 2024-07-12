/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { useEffect, useState } from "react";
import { User } from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { useCurrentUser } from "../user-context";

const contentList = [
    {
        url: "https://www.gitpod.io/blog/writing-software-with-chopsticks-an-intro-to-vdi",
        title: "Why replace your VDI with CDE",
        label: "vdi-replacement",
        priority: 1,
    },
    {
        url: "https://www.gitpod.io/customers/luminus",
        title: "Solve python dependency issues with Gitpod",
        label: "luminus-case-study",
        priority: 2,
    },
    {
        url: "https://www.gitpod.io/blog/how-to-use-vdis-and-cdes-together",
        title: "Using VDIs and Gitpod together",
        label: "vdi-and-cde",
        priority: 3,
    },
    {
        url: "https://www.gitpod.io/blog/onboard-contractors-securely-and-quickly-using-gitpod",
        title: "Onboard contractors with Gitpod",
        label: "onboard-contractors",
        priority: 4,
    },
    {
        url: "https://www.gitpod.io/solutions/onboarding",
        title: "Onboarding developers in one click",
        label: "onboarding-solutions",
        priority: 5,
    },
    {
        url: "https://www.gitpod.io/customers/kingland",
        title: "How Gitpod impacts supply chain security",
        label: "kingland-case-study",
        priority: 6,
    },
    {
        url: "https://www.gitpod.io/blog/improve-security-using-ephemeral-development-environments",
        title: "Improve security with ephemeral environments",
        label: "ephemeral-security",
        priority: 7,
    },
    {
        url: "https://www.gitpod.io/blog/using-a-cde-roi-calculator",
        title: "Building a business case for Gitpod",
        label: "cde-roi-calculator",
        priority: 8,
    },
    {
        url: "https://www.gitpod.io/blog/whats-a-cloud-development-environment",
        title: "What's a CDE",
        label: "what-is-cde",
        priority: 9,
    },
];

// const defaultContent = [
//     { url: "https://www.gitpod.io/blog/whats-a-cloud-development-environment", title: "What's a CDE" },
//     { url: "https://www.gitpod.io/solutions/onboarding", title: "Onboarding developers in one click" },
//     { url: "https://www.gitpod.io/blog/using-a-cde-roi-calculator", title: "Building a business case for Gitpod" },
// ];

const PersonalizedContent: React.FC = () => {
    const user = useCurrentUser();
    const [selectedContent, setSelectedContent] = useState<Array<{ url: string; title: string }>>([]);

    console.log("User: ", user?.profile);

    useEffect(() => {
        const storedContentData = localStorage.getItem("personalized-content-data");
        const currentTime = new Date().getTime();

        let content: Array<{ url: string; title: string; priority?: number }> = [];

        if (storedContentData) {
            const { lastTime /* , phase */ } = JSON.parse(storedContentData);
            const weeksPassed = Math.floor((currentTime - lastTime) / (7 * 24 * 60 * 60 * 1000));

            if (weeksPassed >= 2) {
                // After 2 weeks, show random content
                content = getRandomContent(contentList, 3);
            } else if (weeksPassed >= 1) {
                // After 1 week, show second set of content
                content = getSecondSetContent(user);
            } else {
                // First week, show personalized content
                content = getPersonalizedContent(user);
            }

            localStorage.setItem(
                "personalized-content-data",
                JSON.stringify({
                    lastTime: currentTime,
                    phase: weeksPassed >= 2 ? "random" : weeksPassed >= 1 ? "second" : "first",
                }),
            );
        } else {
            // First visit, show personalized content
            content = getPersonalizedContent(user);
            localStorage.setItem(
                "personalized-content-data",
                JSON.stringify({ lastTime: currentTime, phase: "first" }),
            );
        }

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

function getPersonalizedContent(user: User | undefined) {
    let content: Array<{ url: string; title: string; priority?: number }> = [];

    if (
        user?.profile?.explorationReasons?.includes("explore-professional") ||
        user?.profile?.explorationReasons?.includes("replace-remote-dev")
    ) {
        content = contentList.filter((item) =>
            ["vdi-replacement", "vdi-and-cde", "onboard-contractors"].includes(item.label),
        );
    } else if (user?.profile?.jobRole === "data") {
        content = [contentList.find((item) => item.label === "luminus-case-study")!];
    } else if (user?.profile?.jobRole === "team-lead") {
        content = contentList.filter((item) => ["onboard-contractors", "ephemeral-security"].includes(item.label));
    }

    if (user?.profile?.signupGoals?.includes("onboarding")) {
        content.push(
            ...contentList.filter((item) => ["onboard-contractors", "onboarding-solutions"].includes(item.label)),
        );
    }

    return content.slice(0, 3);
}

function getSecondSetContent(user: User | undefined) {
    return [
        contentList.find((item) => item.label === "onboarding-solutions")!,
        contentList.find((item) => item.label === "cde-roi-calculator")!,
        contentList.find((item) => item.label === "what-is-cde")!,
    ];
}

function getRandomContent(list: Array<{ url: string; title: string; priority?: number }>, count: number) {
    const shuffled = [...list].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

export default PersonalizedContent;
