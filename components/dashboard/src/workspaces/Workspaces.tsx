/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useCallback, useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import { WorkspaceEntry } from "./WorkspaceEntry";
import { ItemsList } from "../components/ItemsList";
import Arrow from "../components/Arrow";
import ConfirmationModal from "../components/ConfirmationModal";
import { useListWorkspacesQuery } from "../data/workspaces/list-workspaces-query";
import { EmptyWorkspacesContent } from "./EmptyWorkspacesContent";
import { WorkspacesSearchBar } from "./WorkspacesSearchBar";
import { hoursBefore, isDateSmallerOrEqual } from "@gitpod/gitpod-protocol/lib/util/timeutil";
import { useDeleteInactiveWorkspacesMutation } from "../data/workspaces/delete-inactive-workspaces-mutation";
import { useToast } from "../components/toasts/Toasts";
import { Workspace, WorkspacePhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { Button } from "@podkit/buttons/Button";
import { VideoCarousel } from "./VideoCarousel";
import { BlogBanners } from "./BlogBanners";
import { Book, BookOpen, Building, ChevronRight, Code, Video } from "lucide-react";
import { ReactComponent as GitpodStrokedSVG } from "../icons/gitpod-stroked.svg";
import PersonalizedContent from "./PersonalizedContent";
import { useListenToWorkspacesWSMessages as useListenToWorkspacesStatusUpdates } from "../data/workspaces/listen-to-workspace-ws-messages";
import { Subheading } from "@podkit/typography/Headings";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { Link } from "react-router-dom";
import { useOrgSettingsQuery } from "../data/organizations/org-settings-query";
import Modal, { ModalBaseFooter, ModalBody, ModalHeader } from "../components/Modal";
import { VideoSection } from "../onboarding/VideoSection";
import { trackVideoClick } from "../Analytics";
import { cn } from "@podkit/lib/cn";
import { useUpdateCurrentUserMutation } from "../data/current-user/update-mutation";
import { useUserLoader } from "../hooks/use-user-loader";
import Tooltip from "../components/Tooltip";
import { useFeatureFlag } from "../data/featureflag-query";
import { useInstallationConfiguration } from "../data/installation/installation-config-query";
import { SuggestedOrgRepository, useOrgSuggestedRepos } from "../data/organizations/suggested-repositories-query";
import { useSuggestedRepositories } from "../data/git-providers/suggested-repositories-query";
import PillLabel from "../components/PillLabel";

export const GETTING_STARTED_DISMISSAL_KEY = "workspace-list-getting-started";

const WorkspacesPage: FunctionComponent = () => {
    const [limit, setLimit] = useState(50);
    const [searchTerm, setSearchTerm] = useState("");
    const [showInactive, setShowInactive] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);

    const { data, isLoading } = useListWorkspacesQuery({ limit });
    const deleteInactiveWorkspaces = useDeleteInactiveWorkspacesMutation();
    useListenToWorkspacesStatusUpdates();

    const { data: org } = useCurrentOrg();
    const { data: orgSettings } = useOrgSettingsQuery();

    const { user } = useUserLoader();
    const { mutate: mutateUser } = useUpdateCurrentUserMutation();

    const { toast } = useToast();

    // Sort workspaces into active/inactive groups
    const { activeWorkspaces, inactiveWorkspaces } = useMemo(() => {
        const sortedWorkspaces = (data || []).sort(sortWorkspaces);
        const activeWorkspaces = sortedWorkspaces.filter((ws) => isWorkspaceActive(ws));

        // respecting the limit, return inactive workspaces as well
        const inactiveWorkspaces = sortedWorkspaces
            .filter((ws) => !isWorkspaceActive(ws))
            .slice(0, limit - activeWorkspaces.length);

        return {
            activeWorkspaces,
            inactiveWorkspaces,
        };
    }, [data, limit]);

    const handlePlay = () => {
        trackVideoClick("create-new-workspace");
    };

    const { data: installationConfig } = useInstallationConfiguration();
    const isDedicatedInstallation = !!installationConfig?.isDedicatedInstallation;

    const isEnterpriseOnboardingEnabled = useFeatureFlag("enterprise_onboarding_enabled");

    const { filteredActiveWorkspaces, filteredInactiveWorkspaces } = useMemo(() => {
        const filteredActiveWorkspaces = activeWorkspaces.filter(
            (info) =>
                `${info.metadata!.name}${info.id}${info.metadata!.originalContextUrl}${
                    info.status?.gitStatus?.cloneUrl
                }${info.status?.gitStatus?.branch}`
                    .toLowerCase()
                    .indexOf(searchTerm.toLowerCase()) !== -1,
        );

        const filteredInactiveWorkspaces = inactiveWorkspaces.filter(
            (info) =>
                `${info.metadata!.name}${info.id}${info.metadata!.originalContextUrl}${
                    info.status?.gitStatus?.cloneUrl
                }${info.status?.gitStatus?.branch}`
                    .toLowerCase()
                    .indexOf(searchTerm.toLowerCase()) !== -1,
        );

        return {
            filteredActiveWorkspaces,
            filteredInactiveWorkspaces,
        };
    }, [activeWorkspaces, inactiveWorkspaces, searchTerm]);

    const handleDeleteInactiveWorkspacesConfirmation = useCallback(async () => {
        try {
            await deleteInactiveWorkspaces.mutateAsync({
                workspaceIds: inactiveWorkspaces.map((info) => info.id),
            });

            setDeleteModalVisible(false);
            toast("Your workspace was deleted");
        } catch (e) {}
    }, [deleteInactiveWorkspaces, inactiveWorkspaces, toast]);

    // initialize a state so that we can be optimistic and reactive, but also use an effect to sync the state with the user's actual profile
    const [showGettingStarted, setShowGettingStarted] = useState<boolean | undefined>(undefined);
    useEffect(() => {
        if (!user?.profile?.coachmarksDismissals[GETTING_STARTED_DISMISSAL_KEY]) {
            setShowGettingStarted(true);
        } else {
            setShowGettingStarted(false);
        }
    }, [user?.profile?.coachmarksDismissals]);

    const { data: userSuggestedRepos } = useSuggestedRepositories({ excludeConfigurations: false });
    const { data: orgSuggestedRepos } = useOrgSuggestedRepos();

    const suggestedRepos = useMemo(() => {
        const userSuggestions =
            userSuggestedRepos
                ?.filter((repo) => {
                    const autostartMatch = user?.workspaceAutostartOptions.find((option) => {
                        return option.cloneUrl.includes(repo.url);
                    });
                    return autostartMatch;
                })
                .slice(0, 3) ?? [];
        const orgSuggestions = (orgSuggestedRepos ?? []).filter((repo) => {
            return !userSuggestions.find((userSuggestion) => userSuggestion.configurationId === repo.configurationId); // don't show duplicates from user's autostart options
        });

        return [...userSuggestions, ...orgSuggestions].slice(0, 3);
    }, [userSuggestedRepos, user, orgSuggestedRepos]);

    const toggleGettingStarted = useCallback(
        (show: boolean) => {
            setShowGettingStarted(show);

            mutateUser(
                {
                    additionalData: {
                        profile: {
                            coachmarksDismissals: {
                                [GETTING_STARTED_DISMISSAL_KEY]: !show ? new Date().toISOString() : "",
                            },
                        },
                    },
                },
                {
                    onError: (e) => {
                        toast("Failed to dismiss getting started");
                        setShowGettingStarted(true);
                    },
                },
            );
        },
        [mutateUser, toast],
    );

    const [isVideoModalVisible, setVideoModalVisible] = useState(false);
    const handleVideoModalClose = useCallback(() => {
        setVideoModalVisible(false);
    }, []);

    return (
        <>
            <Header
                title="Workspaces"
                subtitle="Manage, start and stop your personal development environments in the cloud."
            />

            {isEnterpriseOnboardingEnabled && isDedicatedInstallation && (
                <>
                    <div className="app-container flex flex-row items-center justify-end mt-4 mb-2">
                        <Tooltip content="Toggle helpful resources for getting started with Gitpod">
                            <Button
                                variant="ghost"
                                onClick={() => toggleGettingStarted(!showGettingStarted)}
                                className="p-2"
                            >
                                <div className="flex flex-row items-center gap-2">
                                    <Subheading className="text-pk-content-primary">Getting started</Subheading>
                                    <ChevronRight
                                        className={`transform transition-transform duration-100 ${
                                            showGettingStarted ? "rotate-90" : ""
                                        }`}
                                        size={20}
                                    />
                                </div>
                            </Button>
                        </Tooltip>
                    </div>

                    {showGettingStarted && (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:px-28 px-4 pb-4">
                                <Card onClick={() => setVideoModalVisible(true)}>
                                    <Video className="flex-shrink-0" size={24} />
                                    <div className="min-w-0">
                                        <CardTitle>Learn how Gitpod works</CardTitle>
                                        <CardDescription>
                                            We've put together resources for you to get the most our of Gitpod.
                                        </CardDescription>
                                    </div>
                                </Card>

                                {orgSettings?.onboardingSettings?.internalLink ? (
                                    <Card href={orgSettings.onboardingSettings.internalLink} isLinkExternal>
                                        <Building className="flex-shrink-0" size={24} />
                                        <div className="min-w-0">
                                            <CardTitle>Learn more about Gitpod at {org?.name}</CardTitle>
                                            <CardDescription>
                                                Read through the internal Gitpod landing page of your organization.
                                            </CardDescription>
                                        </div>
                                    </Card>
                                ) : (
                                    <Card href={"/new?showExamples=true"}>
                                        <Code className="flex-shrink-0" size={24} />
                                        <div className="min-w-0">
                                            <CardTitle>Open a sample repository</CardTitle>
                                            <CardDescription>
                                                Explore{" "}
                                                {orgSuggestedRepos?.length
                                                    ? "repositories recommended by your organization"
                                                    : "a sample repository"}
                                                to quickly experience Gitpod.
                                            </CardDescription>
                                        </div>
                                    </Card>
                                )}

                                <Card href="https://www.gitpod.io/docs/introduction" isLinkExternal>
                                    <Book className="flex-shrink-0" size={24} />
                                    <div className="min-w-0">
                                        <CardTitle>Visit the docs</CardTitle>
                                        <CardDescription>
                                            We have extensive documentation to help if you get stuck.
                                        </CardDescription>
                                    </div>
                                </Card>
                            </div>

                            {suggestedRepos.length > 0 && (
                                <>
                                    <Subheading className="font-semibold text-pk-content-primary mb-2 app-container">
                                        Suggested
                                    </Subheading>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:px-28 px-4">
                                        {suggestedRepos.map((repo) => {
                                            const isOrgSuggested =
                                                (repo as SuggestedOrgRepository).orgSuggested ?? false;

                                            return (
                                                <Card
                                                    key={repo.url}
                                                    href={`/new#${repo.url}`}
                                                    className={cn(
                                                        "border-[0.5px] hover:bg-pk-surface-tertiary transition-colors w-full",
                                                        {
                                                            "border-[#D79A45]": isOrgSuggested,
                                                            "border-pk-border-base": !isOrgSuggested,
                                                        },
                                                    )}
                                                >
                                                    <div className="min-w-0 w-full space-y-1.5">
                                                        <CardTitle className="flex flex-row items-center gap-2 w-full">
                                                            <span className="truncate block min-w-0 text-base">
                                                                {repo.configurationName || repo.repoName}
                                                            </span>
                                                            {isOrgSuggested && (
                                                                <PillLabel
                                                                    className="capitalize bg-kumquat-light shrink-0 text-sm"
                                                                    type="warn"
                                                                >
                                                                    Recommended
                                                                </PillLabel>
                                                            )}
                                                        </CardTitle>
                                                        <CardDescription className="truncate text-sm opacity-75">
                                                            {repo.url}
                                                        </CardDescription>
                                                    </div>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                    <Modal
                        visible={isVideoModalVisible}
                        onClose={handleVideoModalClose}
                        containerClassName="min-[576px]:max-w-[600px]"
                    >
                        <ModalHeader>Demo video</ModalHeader>
                        <ModalBody>
                            <div className="flex flex-row items-center justify-center">
                                <VideoSection
                                    metadataVideoTitle="Gitpod demo"
                                    playbackId="m01BUvCkTz7HzQKFoIcQmK00Rx5laLLoMViWBstetmvLs"
                                    poster="https://i.ytimg.com/vi_webp/1ZBN-b2cIB8/maxresdefault.webp"
                                    playerProps={{ onPlay: handlePlay, defaultHiddenCaptions: true }}
                                    className="w-[535px] rounded-xl"
                                />
                            </div>
                        </ModalBody>
                        <ModalBaseFooter>
                            <Button variant="secondary" onClick={handleVideoModalClose}>
                                Close
                            </Button>
                        </ModalBaseFooter>
                    </Modal>
                </>
            )}

            {deleteModalVisible && (
                <ConfirmationModal
                    title="Delete Inactive Workspaces"
                    areYouSureText="Are you sure you want to delete all inactive workspaces?"
                    buttonText="Delete Inactive Workspaces"
                    onClose={() => setDeleteModalVisible(false)}
                    onConfirm={handleDeleteInactiveWorkspacesConfirmation}
                    visible
                />
            )}

            {!isLoading &&
                (activeWorkspaces.length > 0 || inactiveWorkspaces.length > 0 || searchTerm ? (
                    <>
                        <div
                            className={
                                !isDedicatedInstallation ? "!pl-0 app-container flex flex-1 flex-row" : "app-container"
                            }
                        >
                            <div>
                                <WorkspacesSearchBar
                                    limit={limit}
                                    searchTerm={searchTerm}
                                    onLimitUpdated={setLimit}
                                    onSearchTermUpdated={setSearchTerm}
                                />
                                <ItemsList className={!isDedicatedInstallation ? "app-container xl:!pr-4 pb-40" : ""}>
                                    <div className="border-t border-gray-200 dark:border-gray-800"></div>
                                    {filteredActiveWorkspaces.map((info) => {
                                        return <WorkspaceEntry key={info.id} info={info} />;
                                    })}
                                    {filteredActiveWorkspaces.length > 0 && <div className="py-6"></div>}
                                    {filteredInactiveWorkspaces.length > 0 && (
                                        <div>
                                            <div
                                                onClick={() => setShowInactive(!showInactive)}
                                                className="flex cursor-pointer p-6 flex-row bg-pk-surface-secondary hover:bg-pk-surface-tertiary text-pk-content-tertiary rounded-xl mb-2"
                                            >
                                                <div className="pr-2">
                                                    <Arrow direction={showInactive ? "down" : "right"} />
                                                </div>
                                                <div className="flex flex-grow flex-col ">
                                                    <div className="font-medium truncate">
                                                        <span>Inactive Workspaces&nbsp;</span>
                                                        <span className="text-gray-400 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 rounded-xl px-2 py-0.5 text-xs">
                                                            {filteredInactiveWorkspaces.length}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm flex-auto">
                                                        Workspaces that have been stopped for more than 24 hours.
                                                        Inactive workspaces are automatically deleted after 14 days.{" "}
                                                        <a
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="gp-link"
                                                            href="https://www.gitpod.io/docs/configure/workspaces/workspace-lifecycle#workspace-deletion"
                                                            onClick={(evt) => evt.stopPropagation()}
                                                        >
                                                            Learn more
                                                        </a>
                                                    </div>
                                                </div>
                                                <div className="self-center">
                                                    {showInactive ? (
                                                        <Button
                                                            variant="ghost"
                                                            // TODO: Remove these classes once we decide on the new button style
                                                            // Leaving these to emulate the old button's danger.secondary style until we decide if we want that style or not
                                                            className="bg-red-50 dark:bg-red-300 hover:bg-red-100 dark:hover:bg-red-200 text-red-600 hover:text-red-700 hover:opacity-100"
                                                            onClick={(evt) => {
                                                                setDeleteModalVisible(true);
                                                                evt.stopPropagation();
                                                            }}
                                                        >
                                                            Delete Inactive Workspaces
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </div>
                                            {showInactive ? (
                                                <>
                                                    {filteredInactiveWorkspaces.map((info) => {
                                                        return <WorkspaceEntry key={info.id} info={info} />;
                                                    })}
                                                </>
                                            ) : null}
                                        </div>
                                    )}
                                </ItemsList>
                            </div>
                            {/* Show Educational if user is in gitpodIo */}
                            {!isDedicatedInstallation && (
                                <div className="max-xl:hidden border-l border-gray-200 dark:border-gray-800 pl-6 pt-5 pb-4 space-y-8">
                                    <VideoCarousel />
                                    <div className="flex flex-col gap-2">
                                        <h3 className="text-lg font-semibold text-pk-content-primary">Documentation</h3>
                                        <div className="flex flex-col gap-1 w-fit">
                                            <a
                                                href="https://www.gitpod.io/docs/introduction"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-pk-content-primary items-center gap-x-2 flex flex-row"
                                            >
                                                <BookOpen width={20} />{" "}
                                                <span className="hover:text-blue-600 dark:hover:text-blue-400">
                                                    Read the docs
                                                </span>
                                            </a>
                                            <a
                                                href="https://www.gitpod.io/docs/configure/workspaces"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-pk-content-primary items-center gap-x-2 flex flex-row"
                                            >
                                                <GitpodStrokedSVG />
                                                <span className="hover:text-blue-600 dark:hover:text-blue-400">
                                                    Configuring a workspace
                                                </span>
                                            </a>
                                            <a
                                                href="https://www.gitpod.io/docs/references/gitpod-yml"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-pk-content-primary items-center gap-x-2 flex flex-row"
                                            >
                                                <Code width={20} />{" "}
                                                <span className="hover:text-blue-600 dark:hover:text-blue-400">
                                                    .gitpod.yml reference
                                                </span>
                                            </a>
                                        </div>
                                    </div>
                                    <PersonalizedContent />
                                    <BlogBanners />
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <EmptyWorkspacesContent />
                ))}
        </>
    );
};

export default WorkspacesPage;

const CardTitle = ({ children, className }: { className?: string; children: React.ReactNode }) => {
    return <span className={cn("text-lg font-semibold text-pk-content-primary", className)}>{children}</span>;
};
const CardDescription = ({ children, className }: { className?: string; children: React.ReactNode }) => {
    return <p className={cn("text-pk-content-secondary", className)}>{children}</p>;
};
type CardProps = {
    children: React.ReactNode;
    href?: string;
    isLinkExternal?: boolean;
    className?: string;
    onClick?: () => void;
};
const Card = ({ children, href, isLinkExternal, className: classNameFromProps, onClick }: CardProps) => {
    const className = cn(
        "bg-pk-surface-secondary flex gap-3 py-4 px-5 rounded-xl text-left w-full h-full",
        classNameFromProps,
    );

    if (href && isLinkExternal) {
        return (
            <a href={href} className={className} target="_blank" rel="noreferrer">
                {children}
            </a>
        );
    }

    if (href) {
        return (
            <Link to={href} className={className}>
                {children}
            </Link>
        );
    }

    if (onClick) {
        return (
            <button className={className} onClick={onClick}>
                {children}
            </button>
        );
    }

    return <div className={className}>{children}</div>;
};

const sortWorkspaces = (a: Workspace, b: Workspace) => {
    const result = workspaceActiveDate(b).localeCompare(workspaceActiveDate(a));
    if (result === 0) {
        // both active now? order by workspace id
        return b.id.localeCompare(a.id);
    }
    return result;
};

/**
 * Given a WorkspaceInfo, return a ISO string of the last related activity
 */
function workspaceActiveDate(info: Workspace): string {
    return info.status!.phase!.lastTransitionTime!.toDate().toISOString();
}

/**
 * Returns a boolean indicating if the workspace should be considered active.
 * A workspace is considered active if it is pinned, not stopped, or was active within the last 24 hours
 *
 * @param info WorkspaceInfo
 * @returns boolean If workspace is considered active
 */
function isWorkspaceActive(info: Workspace): boolean {
    const lastSessionStart = info.status!.phase!.lastTransitionTime!.toDate().toISOString();
    const twentyfourHoursAgo = hoursBefore(new Date().toISOString(), 24);

    const isStopped = info.status?.phase?.name === WorkspacePhase_Phase.STOPPED;
    return info.metadata!.pinned || !isStopped || isDateSmallerOrEqual(twentyfourHoursAgo, lastSessionStart);
}
