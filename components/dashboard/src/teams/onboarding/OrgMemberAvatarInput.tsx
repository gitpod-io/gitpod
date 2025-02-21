/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMemo, useState } from "react";
import { useListOrganizationMembers } from "../../data/organizations/members-query";

import type { OnboardingSettings_WelcomeMessage } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { Button } from "@podkit/buttons/Button";
import { Popover, PopoverContent, PopoverTrigger } from "@podkit/popover/Popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandGroup, CommandInput, CommandItem } from "@podkit/command/Command";
import { cn } from "@podkit/lib/cn";

type Props = {
    settings: OnboardingSettings_WelcomeMessage | undefined;
    setFeaturedMemberId: (featuredMemberId: string | undefined) => void;
};
export const OrgMemberAvatarInput = ({ settings, setFeaturedMemberId }: Props) => {
    const { data: members } = useListOrganizationMembers();
    const [open, setOpen] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(settings?.featuredMemberResolvedAvatarUrl);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [search, _setSearch] = useState<string | undefined>(undefined);

    const allOptions = useMemo(
        () => [{ userId: "disabled", fullName: "Disable image", avatarUrl: undefined }, ...(members ?? [])],
        [members],
    );

    const filteredOptions = useMemo(() => {
        return allOptions.filter((member) => {
            const fullName = member.fullName.toLowerCase();
            const searchTerms = search?.toLowerCase() ?? "";
            return fullName.includes(searchTerms);
        });
    }, [allOptions, search]);

    const selectedMember = allOptions.find(
        (member) => member.avatarUrl === avatarUrl || (avatarUrl === undefined && member.userId === "disabled"),
    );

    return (
        <div className="flex flex-col items-center gap-4">
            {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full" />
            ) : (
                <div className="w-16 h-16 rounded-full bg-[#EA71DE]" />
            )}

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={open} className="w-48 justify-between">
                        {selectedMember?.fullName ?? "Select member..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-0">
                    <Command shouldFilter={true}>
                        <CommandInput
                            // value={search}
                            // onValueChange={(value) => setSearch(value)}
                            className="h-9"
                            placeholder="Search members..."
                        />
                        <CommandGroup>
                            {filteredOptions.map((member) => (
                                <CommandItem
                                    key={member.userId}
                                    value={member.userId}
                                    onSelect={(newMemberId) => {
                                        setFeaturedMemberId(newMemberId === "disabled" ? undefined : newMemberId);
                                        setAvatarUrl(member.avatarUrl);
                                        setOpen(false);
                                    }}
                                >
                                    {member.avatarUrl ? (
                                        <img
                                            src={member.avatarUrl}
                                            alt={member.fullName}
                                            className="w-4 h-4 rounded-full"
                                        />
                                    ) : (
                                        <div className="w-4 h-4 rounded-full bg-pk-surface-tertiary" />
                                    )}
                                    {member.fullName}
                                    <Check
                                        className={cn(
                                            "ml-auto h-4 w-4",
                                            selectedMember?.userId === member.userId ? "opacity-100" : "opacity-0",
                                        )}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
};
