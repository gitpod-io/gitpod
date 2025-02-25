/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useMemo, useState } from "react";
import { useListOrganizationMembers } from "../../data/organizations/members-query";
import type { OnboardingSettings_WelcomeMessage } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { Combobox } from "../../prebuilds/configuration-input/Combobox";
import { ComboboxSelectedItem } from "../../prebuilds/configuration-input/ComboboxSelectedItem";

type Props = {
    settings: OnboardingSettings_WelcomeMessage | undefined;
    setFeaturedMemberId: (featuredMemberId: string | undefined) => void;
};
export const OrgMemberAvatarInput = ({ settings, setFeaturedMemberId }: Props) => {
    const { data: members, isLoading } = useListOrganizationMembers();
    const [searchTerm, setSearchTerm] = useState("");
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(settings?.featuredMemberResolvedAvatarUrl);

    const selectedMember = useMemo(() => {
        return members?.find((member) => member.avatarUrl === avatarUrl);
    }, [members, avatarUrl]);

    const handleSelectionChange = useCallback(
        (selectedId: string) => {
            const member = members?.find((m) => m.userId === selectedId);
            setFeaturedMemberId(selectedId);
            setAvatarUrl(member?.avatarUrl);
        },
        [members, setFeaturedMemberId],
    );

    const getElements = useCallback(() => {
        const resetFilterItem = {
            id: "",
            element: <SuggestedMemberOption member={{ fullName: "Disable image" }} />,
            isSelectable: true,
        };

        if (!members) {
            return [resetFilterItem];
        }

        const filteredMembers = members.filter((member) =>
            member.fullName.toLowerCase().includes(searchTerm.toLowerCase().trim()),
        );

        const result = filteredMembers.map((member) => ({
            id: member.userId,
            element: <SuggestedMemberOption member={member} />,
            isSelectable: true,
        }));
        if (searchTerm.length === 0) result.unshift(resetFilterItem);

        return result;
    }, [members, searchTerm]);

    return (
        <div className="flex flex-col items-center gap-4">
            {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full" />
            ) : (
                <div className="w-16 h-16 rounded-full bg-[#EA71DE]" />
            )}

            <div className="w-48">
                <Combobox
                    getElements={getElements}
                    initialValue={selectedMember?.userId}
                    onSelectionChange={handleSelectionChange}
                    disabled={isLoading}
                    loading={isLoading}
                    onSearchChange={setSearchTerm}
                    dropDownClassName="text-pk-content-primary"
                >
                    <ComboboxSelectedItem
                        htmlTitle="Member"
                        title={<div className="truncate">{selectedMember?.fullName ?? "Select member..."}</div>}
                        titleClassName="text-sm font-normal text-pk-content-primary"
                        loading={isLoading}
                        icon={
                            selectedMember?.avatarUrl ? (
                                <img src={selectedMember.avatarUrl} alt="" className="w-4 h-4 rounded-full" />
                            ) : (
                                <div className="w-4 h-4 rounded-full bg-pk-content-tertiary" />
                            )
                        }
                    />
                </Combobox>
            </div>
        </div>
    );
};

type SuggestedMemberOptionProps = {
    member: {
        fullName: string;
        avatarUrl?: string;
    };
};
const SuggestedMemberOption: FC<SuggestedMemberOptionProps> = ({ member }) => {
    const { fullName, avatarUrl } = member;

    return (
        <div className="flex flex-row items-center overflow-hidden" title={fullName} aria-label={`Member: ${fullName}`}>
            {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-4 h-4 rounded-full mr-2" />
            ) : (
                <div className="w-4 h-4 rounded-full mr-2 bg-pk-content-tertiary" />
            )}
            {fullName && <span className="text-sm whitespace-nowrap">{fullName}</span>}
        </div>
    );
};
