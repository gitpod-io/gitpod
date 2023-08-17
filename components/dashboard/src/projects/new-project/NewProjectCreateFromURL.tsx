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
    const showCreateFromURL = useMemo(() => {
        // TODO: Only accounts for https urls, need to account for ssh clone urls too?
        const looksLikeURL = isURL(repoSearchFilter, {
            require_protocol: true,
            protocols: ["https"],
        });

        const hasTrailingGit = /\.git$/.test(repoSearchFilter);

        return looksLikeURL && hasTrailingGit;
    }, [repoSearchFilter]);

    const normalizedURL = useMemo(() => {
        let url = repoSearchFilter.toLowerCase().trim();

        return url;
    }, [repoSearchFilter]);

    const handleCreate = useCallback(() => {
        let name = "";
        let slug = "";

        try {
            // try and parse the url for owner/repo path parts
            console.log("url: ", normalizedURL.substring(0, normalizedURL.length - 4));
            const [owner, repo] = new URL(normalizedURL.substring(0, normalizedURL.length - 4)).pathname.split("/");
            if (!owner && !repo) {
                throw new Error();
            }
            name = repo || owner;
            slug = repo || owner;
        } catch (e) {
            toast("Sorry, it looks like we can't handle that URL. Is it a valid git clone url?");
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
