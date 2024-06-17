/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Button } from "@podkit/buttons/Button";
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from "@podkit/popover/Popover";
import { Text } from "@podkit/typography/Text";
import { Truck } from "lucide-react";
import { PropsWithChildren, useCallback, useMemo, useState } from "react";
import { Link, useHistory } from "react-router-dom";
import { useUserLoader } from "../../hooks/use-user-loader";
import { useUpdateCurrentUserMutation } from "../../data/current-user/update-mutation";
import dayjs from "dayjs";
import { trackEvent } from "../../Analytics";

const COACHMARK_KEY = "projects_configuration_migration";

type Props = PropsWithChildren<{}>;
export const ConfigurationsMigrationCoachmark = ({ children }: Props) => {
    const [isOpen, setIsOpen] = useState(true);

    const history = useHistory();

    const { user } = useUserLoader();
    const { mutate: updateUser } = useUpdateCurrentUserMutation();

    const dismiss = useCallback(() => {
        updateUser(
            {
                additionalData: { profile: { coachmarksDismissals: { [COACHMARK_KEY]: dayjs().toISOString() } } },
            },
            {
                onSettled: (_, error) => {
                    trackEvent("coachmark_dismissed", {
                        name: COACHMARK_KEY,
                        success: !(error instanceof Error),
                    });
                },
            },
        );
    }, [updateUser]);

    const show = useMemo<boolean>(() => {
        if (!isOpen || !user) {
            return false;
        }

        // For the users signing up after our launch of configurations, don't show it
        if (user.createdAt && user.createdAt.toDate() > new Date("2/21/2024")) {
            return false;
        }

        // User already knows about the feature
        if (history.location.pathname.startsWith("/repositories")) {
            dismiss();
            return false;
        }

        return !user.profile?.coachmarksDismissals[COACHMARK_KEY];
    }, [dismiss, history.location.pathname, isOpen, user]);

    const handleClose = useCallback(() => {
        setIsOpen(false);
        // do not store the dismissal if the popover is not shown
        if (show) {
            dismiss();
        }
    }, [dismiss, show]);

    return (
        <Popover open={show}>
            <PopoverTrigger onClick={handleClose}>{children}</PopoverTrigger>
            <PopoverContent align={"start"} className="border-pk-border-base relative flex flex-col">
                <PopoverArrow asChild>
                    <div className="mb-[6px] ml-2 inline-block overflow-hidden rotate-180 relative">
                        <div className="h-3 w-5 origin-bottom-left rotate-45 transform border border-pk-border-base bg-pk-surface-primary before:absolute before:bottom-0 before:left-0 before:w-full before:h-[1px] before:bg-pk-surface-primary" />
                    </div>
                </PopoverArrow>

                <Text className="flex flex-row gap-2 text-lg font-bold items-center pt-3">
                    <Truck /> Projects have moved
                </Text>
                <Text className="text-pk-content-secondary text-base pb-4 pt-2">
                    Projects are now called “
                    <Link to={"/repositories"} className="gp-link">
                        Repository settings
                    </Link>
                    ”. You can find them in your organization menu.
                </Text>
                <Button className="self-end" variant={"secondary"} onClick={handleClose}>
                    Dismiss
                </Button>
            </PopoverContent>
        </Popover>
    );
};
