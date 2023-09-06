/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ProviderRepository } from "@gitpod/gitpod-protocol";
import dayjs from "dayjs";
import { FC } from "react";
import { Button } from "../../components/Button";

type Props = {
    filteredRepos: ProviderRepository[];
    noReposAvailable: boolean;
    isCreating: boolean;
    onRepoSelected: (repo: ProviderRepository) => void;
};
export const NewProjectRepoList: FC<Props> = ({ filteredRepos, noReposAvailable, isCreating, onRepoSelected }) => {
    return (
        <>
            {filteredRepos.length > 0 && (
                <div className="overscroll-contain max-h-80 overflow-y-auto pr-2">
                    {filteredRepos.map((r, index) => (
                        <div
                            key={`repo-${index}-${r.account}-${r.name}`}
                            className="flex p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-kumquat-light transition ease-in-out group"
                            title={r.cloneUrl}
                        >
                            <div className="flex-grow">
                                <div
                                    className={
                                        "text-base text-gray-900 dark:text-gray-50 font-medium rounded-xl whitespace-nowrap" +
                                        (r.inUse ? " text-gray-400 dark:text-gray-500" : "text-gray-700")
                                    }
                                >
                                    {toSimpleName(r)}
                                </div>
                                {r.updatedAt && <p>Updated {dayjs(r.updatedAt).fromNow()}</p>}
                            </div>
                            <div className="flex justify-end">
                                <div className="h-full my-auto flex self-center opacity-0 group-hover:opacity-100 items-center mr-2 text-right">
                                    {!r.inUse ? (
                                        <Button onClick={() => onRepoSelected(r)} loading={isCreating}>
                                            Select
                                        </Button>
                                    ) : (
                                        <p className="text-gray-500 font-medium">
                                            Project already
                                            <br />
                                            exists.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {!noReposAvailable && filteredRepos.length === 0 && <p className="text-center">No Results</p>}
        </>
    );
};

const toSimpleName = (repo: ProviderRepository) => {
    return `${repo.account}/${repo.name}`;
};
