/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useState } from "react";
import { useListOrganizationMembers } from "../../data/organizations/members-query";

import type { OnboardingSettings_WelcomeMessage } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { Button } from "@podkit/buttons/Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@podkit/dropdown/DropDown";

type Props = {
    settings: OnboardingSettings_WelcomeMessage | undefined;
    setFeaturedMemberId: (featuredMemberId: string | undefined) => void;
};
export const OrgMemberAvatarInput = ({ settings, setFeaturedMemberId }: Props) => {
    const { data: members } = useListOrganizationMembers();

    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(settings?.featuredMemberResolvedAvatarUrl);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger>
                <div className="flex flex-col justify-center items-center gap-2">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full" />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-[#EA71DE]" />
                    )}
                    <Button variant="secondary" size="sm" type="button">
                        Change Photo
                    </Button>
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem
                    key="disabled"
                    onClick={() => {
                        setFeaturedMemberId(undefined);
                        setAvatarUrl(undefined);
                    }}
                >
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-pk-surface-tertiary" />
                        Disable image
                    </div>
                </DropdownMenuItem>
                {members?.map((member) => (
                    <DropdownMenuItem
                        key={member.userId}
                        onClick={() => {
                            setFeaturedMemberId(member.userId);
                            setAvatarUrl(member.avatarUrl);
                        }}
                    >
                        <div className="flex items-center gap-2">
                            <img src={member.avatarUrl} alt={member.fullName} className="w-4 h-4 rounded-full" />
                            {member.fullName}
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
