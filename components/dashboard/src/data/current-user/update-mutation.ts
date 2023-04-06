/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { useMutation } from "@tanstack/react-query";
import { trackEvent } from "../../Analytics";
import { getGitpodService } from "../../service/service";
import { useCurrentUser } from "../../user-context";

type UpdateCurrentUserArgs = Partial<User>;

export const useUpdateCurrentUserMutation = () => {
    return useMutation({
        mutationFn: async (partialUser: UpdateCurrentUserArgs) => {
            return await getGitpodService().server.updateLoggedInUser(partialUser);
        },
    });
};

export const useUpdateCurrentUserDotfileRepoMutation = () => {
    const user = useCurrentUser();
    const updateUser = useUpdateCurrentUserMutation();

    return useMutation({
        mutationFn: async (dotfileRepo: string) => {
            if (!user) {
                throw new Error("No user present");
            }

            const additionalData = {
                ...(user.additionalData || {}),
                dotfileRepo,
            };
            const updatedUser = await updateUser.mutateAsync({ additionalData });

            return updatedUser;
        },
        onMutate: async () => {
            return {
                previousDotfileRepo: user?.additionalData?.dotfileRepo || "",
            };
        },
        onSuccess: (updatedUser, _, context) => {
            if (updatedUser?.additionalData?.dotfileRepo !== context?.previousDotfileRepo) {
                trackEvent("dotfile_repo_changed", {
                    previous: context?.previousDotfileRepo ?? "",
                    current: updatedUser?.additionalData?.dotfileRepo ?? "",
                });
            }
        },
    });
};
