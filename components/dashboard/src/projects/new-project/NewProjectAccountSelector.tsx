/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { useIsGithubAppEnabled } from "../../data/git-providers/github-queries";
import ContextMenu, { ContextMenuEntry } from "../../components/ContextMenu";
import classNames from "classnames";
import CaretDown from "../../icons/CaretDown.svg";
import Plus from "../../icons/Plus.svg";
import Switch from "../../icons/Switch.svg";
import { useCurrentUser } from "../../user-context";

type Props = {
    selectedAccount?: string;
    selectedProviderHost?: string;
    accounts: Map<string, { avatarUrl: string }>;
    onAccountSelected: (account: string) => void;
    onAddGitHubAccount: () => void;
    onSelectGitProvider: () => void;
};
export const NewProjectAccountSelector: FC<Props> = ({
    selectedAccount,
    selectedProviderHost,
    accounts,
    onAccountSelected,
    onAddGitHubAccount,
    onSelectGitProvider,
}) => {
    const user = useCurrentUser();
    const { data: isGitHubAppEnabled } = useIsGithubAppEnabled();
    const isGitHub = selectedProviderHost === "github.com";

    const icon = selectedAccount && accounts.get(selectedAccount)?.avatarUrl;

    const menuEntries = useDropdownMenuEntries({
        accounts,
        selectedAccount,
        includeAddGitHubAccount: isGitHub && isGitHubAppEnabled,
        onAccountSelected,
        onAddGitHubAccount,
        onSelectGitProvider,
    });

    return (
        <ContextMenu customClasses="w-full left-0 cursor-pointer" menuEntries={menuEntries}>
            <div className="w-full">
                {!selectedAccount && user && user.name && user.avatarUrl && (
                    <>
                        <img
                            src={user?.avatarUrl}
                            className="rounded-full w-6 h-6 absolute my-2.5 left-3"
                            alt="user avatar"
                        />
                        <input
                            className="w-full px-12 cursor-pointer font-semibold"
                            readOnly
                            type="text"
                            value={user?.name}
                        ></input>
                    </>
                )}
                {selectedAccount && (
                    <>
                        <img
                            src={icon ? icon : ""}
                            className="rounded-full w-6 h-6 absolute my-2.5 left-3"
                            alt="icon"
                        />
                        <input
                            className="w-full px-12 cursor-pointer font-semibold"
                            readOnly
                            type="text"
                            value={selectedAccount}
                        ></input>
                    </>
                )}
                <img
                    src={CaretDown}
                    title="Select Account"
                    className="filter-grayscale absolute top-1/2 right-3"
                    alt="down caret icon"
                />
            </div>
        </ContextMenu>
    );
};

type UseDropdownMenuEntriesArgs = {
    accounts: Map<string, { avatarUrl: string }>;
    selectedAccount?: string;
    includeAddGitHubAccount?: boolean;
    onAccountSelected: (account: string) => void;
    onAddGitHubAccount: () => void;
    onSelectGitProvider: () => void;
};
const useDropdownMenuEntries = ({
    accounts,
    selectedAccount,
    includeAddGitHubAccount,
    onAccountSelected,
    onAddGitHubAccount,
    onSelectGitProvider,
}: UseDropdownMenuEntriesArgs) => {
    const user = useCurrentUser();

    const result: ContextMenuEntry[] = [];

    if (!selectedAccount && user && user.name && user.avatarUrl) {
        result.push({
            title: "user",
            customContent: <DropdownMenuItem label={user?.name} icon={user?.avatarUrl} />,
            separator: true,
        });
    }
    for (const [account, props] of accounts.entries()) {
        result.push({
            title: account,
            customContent: <DropdownMenuItem label={account} icon={props.avatarUrl} className="font-semibold" />,
            separator: true,
            onClick: () => onAccountSelected(account),
        });
    }
    if (includeAddGitHubAccount) {
        result.push({
            title: "Add another GitHub account",
            customContent: <DropdownMenuItem label="Add GitHub Orgs or Account" icon={Plus} />,
            separator: true,
            onClick: onAddGitHubAccount,
        });
    }
    result.push({
        title: "Select another Git Provider to continue with",
        customContent: <DropdownMenuItem label="Select Git Provider" icon={Switch} />,
        onClick: onSelectGitProvider,
    });

    return result;
};

const DropdownMenuItem: FC<{ label: string; icon: string; className?: string }> = ({ label, icon, className }) => {
    return (
        <div className="w-full flex">
            <img src={icon} className="rounded-full w-6 h-6 my-auto" alt="icon" />
            <span className={classNames("pl-2 text-gray-600 dark:text-gray-100 text-base", className)}>{label}</span>
        </div>
    );
};
