/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AdditionalUserData, User as UserProtocol } from "@gitpod/gitpod-protocol";
import { useMutation } from "@tanstack/react-query";
import { trackEvent } from "../../Analytics";
import { getGitpodService } from "../../service/service";
import { useAuthenticatedUser } from "./authenticated-user-query";
import { converter } from "../../service/public-api";
import deepmerge from "deepmerge";

type UpdateCurrentUserArgs = Partial<UserProtocol>;

export const useUpdateCurrentUserMutation = () => {
    return useMutation({
        mutationFn: async (partialUser: UpdateCurrentUserArgs) => {
            const current = await getGitpodService().server.getLoggedInUser();
            const update: UpdateCurrentUserArgs = {
                id: current.id,
                fullName: partialUser.fullName || current.fullName,
                additionalData: deepmerge<AdditionalUserData>(
                    current.additionalData || {},
                    partialUser.additionalData || {},
                ),
            };
            const user = await getGitpodService().server.updateLoggedInUser(update);
            return converter.toUser(user);
        },
    });
};

export const useUpdateCurrentUserDotfileRepoMutation = () => {
    const { data: user } = useAuthenticatedUser();
    const updateUser = useUpdateCurrentUserMutation();

    return useMutation({
        mutationFn: async (dotfileRepo: string) => {
            if (!user) {
                throw new Error("No user present");
            }

            const additionalData = {
                dotfileRepo,
            };
            const updatedUser = await updateUser.mutateAsync({ additionalData });

            return updatedUser;
        },
        onMutate: async () => {
            return {
                previousDotfileRepo: user?.dotfileRepo || "",
            };
        },
        onSuccess: (updatedUser, _, context) => {
            if (updatedUser?.dotfileRepo !== context?.previousDotfileRepo) {
                trackEvent("dotfile_repo_changed", {
                    previous: context?.previousDotfileRepo ?? "",
                    current: updatedUser?.dotfileRepo ?? "",
                });
            }
        },
    });
};
