/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export type PredefinedRepo = {
    url: string;
    repoName: string;
    description: string;
    /**
     * The configuration ID of the repository.
     * This is only set for org-recommended repos.
     */
    configurationId?: string;
};

export const PREDEFINED_REPOS: PredefinedRepo[] = [
    {
        url: "https://github.com/gitpod-demos/voting-app",
        repoName: "demo-docker",
        description: "A fully configured demo with Docker Compose, Redis and Postgres",
    },
    {
        url: "https://github.com/gitpod-demos/spring-petclinic",
        repoName: "demo-java",
        description: "A fully configured demo with Java, Maven and Spring Boot",
    },
];
