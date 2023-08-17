/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useMemo } from "react";
import isURL from "validator/lib/isURL";
import { CreateProjectArgs } from "../../data/projects/create-project-mutation";
import { Subheading } from "../../components/typography/headings";
import { Button } from "../../components/Button";
import { useToast } from "../../components/toasts/Toasts";

type Props = {
    repoSearchFilter: string;
    isCreating: boolean;
    onCreateProject: (args: CreateProjectArgs) => void;
};
export const NewProjectCreateFromURL: FC<Props> = ({ repoSearchFilter, isCreating, onCreateProject }) => {
    const { toast } = useToast();

    const normalizedURL = useMemo(() => {
        let url = repoSearchFilter.toLocaleLowerCase().trim();

        // Just parse out the origin/pathname to remove any query params or hash
        try {
            const parsedURL = new URL(url);
            const { origin, pathname } = parsedURL;
            url = `${origin}${pathname}`;
        } catch (e) {
            return url;
        }

        return url;
    }, [repoSearchFilter]);

    const showCreateFromURL = useMemo(() => {
        // TODO: Only accounts for https urls currently
        const looksLikeURL = isURL(normalizedURL, {
            require_protocol: true,
            protocols: ["https"],
        });

        const hasTrailingGit = /\.git$/.test(normalizedURL);

        return looksLikeURL && hasTrailingGit;
    }, [normalizedURL]);

    const handleCreate = useCallback(() => {
        let name = "";
        let slug = "";

        try {
            // try and parse the url for owner/repo path parts
            const segments = new URL(normalizedURL.substring(0, normalizedURL.length - ".git".length)).pathname
                .split("/")
                .filter(Boolean);

            // Repo is last segment
            const repo = segments.pop();
            // owner is everything else
            const owner = segments.join("-");

            if (!repo) {
                throw new Error();
            }

            name = repo;
            slug = [repo, owner].filter(Boolean).join("-").toLowerCase();
        } catch (e) {
            toast("Sorry, it looks like we can't handle that URL. Is it a valid git clone URL?");
            return;
        }

        onCreateProject({
            name,
            slug,
            cloneUrl: normalizedURL,
            appInstallationId: "",
        });
    }, [normalizedURL, onCreateProject, toast]);

    if (!showCreateFromURL) {
        return null;
    }

    return (
        <div className="flex flex-col items-center">
            <Subheading>Create project from Git clone URL?</Subheading>

            <pre className="my-2 font-mono text-sm">{normalizedURL}</pre>

            <Button onClick={handleCreate} loading={isCreating}>
                Create Project
            </Button>
        </div>
    );
};
