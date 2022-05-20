/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React, { Suspense, useContext, useEffect, useState } from "react";
import { Project } from "@gitpod/gitpod-protocol";
import TabMenuItem from "../components/TabMenuItem";
import { getGitpodService } from "../service/service";
import Spinner from "../icons/Spinner.svg";
import NoAccess from "../icons/NoAccess.svg";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { openAuthorizeWindow } from "../provider-utils";
import { ProjectSettingsPage } from "./ProjectSettings";
import { ProjectContext } from "./project-context";

const MonacoEditor = React.lazy(() => import("../components/MonacoEditor"));

const TASKS = {
    Other: `tasks:
  - init: |
      echo 'TODO: build project'
    command: |
      echo 'TODO: start app'`,
};

export default function () {
    const { project } = useContext(ProjectContext);
    const [gitpodYml, setGitpodYml] = useState<string>("");
    const [dockerfile, setDockerfile] = useState<string>("");
    const [editorMessage, setEditorMessage] = useState<React.ReactNode | null>(null);
    const [selectedEditor, setSelectedEditor] = useState<".gitpod.yml" | ".gitpod.Dockerfile">(".gitpod.yml");
    const [isEditorDisabled, setIsEditorDisabled] = useState<boolean>(true);
    const [isDetecting, setIsDetecting] = useState<boolean>(true);
    const [progressMessage, setProgressMessage] = useState<string>("");
    const [showAuthBanner, setShowAuthBanner] = useState<{ host: string; scope?: string } | undefined>(undefined);
    const [buttonNewWorkspaceEnabled, setButtonNewWorkspaceEnabled] = useState<boolean>(true);

    useEffect(() => {
        // Disable editing while loading, or when the config comes from Git.
        setIsDetecting(true);
        setIsEditorDisabled(true);
        setEditorMessage(null);
        (async () => {
            if (!project) {
                setIsDetecting(false);
                setEditorMessage(
                    <EditorMessage
                        type="warning"
                        heading="Couldn't load project information."
                        message="Please try to reload this page."
                    />,
                );
                return;
            }
            try {
                await detectProjectConfiguration(project);
            } catch (error) {
                if (error && error.message && error.message.includes("NotFound")) {
                    const host = new URL(project.cloneUrl).hostname;
                    const scope: string | undefined = host === "github.com" ? "repo" : undefined;
                    setShowAuthBanner({ host: new URL(project.cloneUrl).hostname, scope });
                } else if (error && error.code === ErrorCodes.NOT_AUTHENTICATED) {
                    setShowAuthBanner({ host: new URL(project.cloneUrl).hostname });
                } else {
                    console.error("Getting project configuration failed", error);
                    setIsDetecting(false);
                    setIsEditorDisabled(true);
                    setEditorMessage(
                        <EditorMessage
                            type="warning"
                            heading="Project type could not be detected."
                            message="Fetching project information failed."
                        />,
                    );
                    setGitpodYml(TASKS.Other);
                }
            }
        })();
    }, [project]);

    const detectProjectConfiguration = async (project: Project) => {
        const guessedConfigStringPromise = getGitpodService().server.guessProjectConfiguration(project.id);
        const repoConfigString = await getGitpodService().server.fetchProjectRepositoryConfiguration(project.id);
        if (repoConfigString) {
            setIsDetecting(false);
            setEditorMessage(
                <EditorMessage
                    type="warning"
                    heading="Configuration already exists in git."
                    message="Open a new workspace to edit project configuration."
                />,
            );
            setGitpodYml(repoConfigString);
            return;
        }
        if (project.config && project.config[".gitpod.yml"]) {
            setIsDetecting(false);
            setIsEditorDisabled(false);
            setGitpodYml(project.config[".gitpod.yml"]);
            return;
        }
        const guessedConfigString = await guessedConfigStringPromise;
        setIsDetecting(false);
        setIsEditorDisabled(false);
        if (guessedConfigString) {
            setEditorMessage(
                <EditorMessage
                    type="success"
                    heading="Project type detected."
                    message="You can edit project configuration below before starting a workspace."
                />,
            );
            setGitpodYml(guessedConfigString);
            return;
        }
        setEditorMessage(
            <EditorMessage
                type="warning"
                heading="Project type could not be detected."
                message="You can edit project configuration below before starting a workspace."
            />,
        );
        setGitpodYml(TASKS.Other);
    };

    const tryAuthorize = async (params: { host: string; scope?: string; onSuccess: () => void }) => {
        try {
            await openAuthorizeWindow({
                host: params.host,
                onSuccess: params.onSuccess,
                scopes: params.scope ? [params.scope] : undefined,
                onError: (error) => {
                    console.log(error);
                },
            });
        } catch (error) {
            console.log(error);
        }
    };

    const onConfirmShowAuthModal = async (host: string, scope?: string) => {
        setShowAuthBanner(undefined);
        await tryAuthorize({
            host,
            scope,
            onSuccess: async () => {
                // update remote session
                await getGitpodService().reconnect();

                // retry fetching branches
                if (project) {
                    detectProjectConfiguration(project);
                }
            },
        });
    };

    useEffect(() => {
        document.title = "Configure Project — Gitpod";
    }, []);

    const onNewWorkspace = async () => {
        if (!project) {
            return;
        }

        setButtonNewWorkspaceEnabled(false);

        if (!isEditorDisabled) {
            try {
                setProgressMessage("Saving project configuration...");
                await getGitpodService().server.setProjectConfiguration(project.id, gitpodYml);

                setProgressMessage("Starting a new prebuild...");
                await getGitpodService().server.triggerPrebuild(project.id, null);
            } catch (error) {
                setEditorMessage(
                    <EditorMessage
                        type="warning"
                        heading="Could not run prebuild."
                        message={String(error).replace(/Error: Request \w+ failed with message: /, "")}
                    />,
                );

                setProgressMessage("");
                setButtonNewWorkspaceEnabled(true);
                return;
            }
        }

        const redirectToNewWorkspace = () => {
            // instead of `history.push` we want forcibly to redirect here in order to avoid a following redirect from `/` -> `/projects` (cf. App.tsx)
            const url = new URL(window.location.toString());
            url.pathname = "/";
            url.hash = project?.cloneUrl!;
            window.location.href = url.toString();
        };

        redirectToNewWorkspace();
        return;
    };

    return (
        <ProjectSettingsPage project={project}>
            <div className="grid xl:grid-cols-1 grid-cols-1">
                <div className="flex-1 h-96 overflow-hidden relative flex flex-col">
                    <div className="flex bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 px-6 pt-3 rounded-t-xl">
                        <TabMenuItem
                            name=".gitpod.yml"
                            selected={selectedEditor === ".gitpod.yml"}
                            onClick={() => setSelectedEditor(".gitpod.yml")}
                        />
                        {!!dockerfile && (
                            <TabMenuItem
                                name=".gitpod.Dockerfile"
                                selected={selectedEditor === ".gitpod.Dockerfile"}
                                onClick={() => setSelectedEditor(".gitpod.Dockerfile")}
                            />
                        )}
                    </div>
                    {editorMessage}
                    <Suspense fallback={<div />}>
                        {selectedEditor === ".gitpod.yml" && (
                            <MonacoEditor
                                classes="w-full flex-grow"
                                disabled={isEditorDisabled}
                                language="yaml"
                                value={gitpodYml}
                                onChange={setGitpodYml}
                            />
                        )}
                        {selectedEditor === ".gitpod.Dockerfile" && (
                            <MonacoEditor
                                classes="w-full flex-grow"
                                disabled={isEditorDisabled}
                                language="dockerfile"
                                value={dockerfile}
                                onChange={setDockerfile}
                            />
                        )}
                    </Suspense>
                    {isDetecting && (
                        <div className="absolute h-full w-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center space-x-2">
                            {showAuthBanner ? (
                                <div className="mt-8 text-gray-500 flex-col">
                                    <div className="p-16 text-center">
                                        <img alt="" src={NoAccess} title="No Access" className="m-auto mb-4" />
                                        <div className="text-center text-gray-600 dark:text-gray-50 pb-3 font-bold">
                                            No Access
                                        </div>
                                        <div className="text-center dark:text-gray-400 pb-3">
                                            Authorize {showAuthBanner.host}{" "}
                                            {showAuthBanner.scope ? (
                                                <>
                                                    and grant <strong>{showAuthBanner.scope}</strong> permission
                                                </>
                                            ) : (
                                                ""
                                            )}{" "}
                                            <br /> to access project configuration.
                                        </div>
                                        <button
                                            className={`primary mr-2 py-2`}
                                            onClick={() =>
                                                onConfirmShowAuthModal(showAuthBanner.host, showAuthBanner.scope)
                                            }
                                        >
                                            Authorize Provider
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <img alt="" className="h-5 w-5 animate-spin" src={Spinner} />
                                    <span className="font-semibold text-gray-400">
                                        Detecting project configuration ...
                                    </span>
                                </>
                            )}
                        </div>
                    )}
                </div>
                <div className="h-20 px-6 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 flex flex-row-reverse space-x-2 rounded-b-xl">
                    <button disabled={isDetecting || !buttonNewWorkspaceEnabled} onClick={onNewWorkspace}>
                        {progressMessage === "" ? "New workspace" : progressMessage}
                    </button>
                </div>
            </div>
        </ProjectSettingsPage>
    );
}

function EditorMessage(props: { heading: string; message: string; type: "success" | "warning" }) {
    return (
        <div
            className={`p-4 flex flex-col ${
                props.type === "success" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"
            }`}
        >
            <strong className={`font-semibold ${props.type === "success" ? "text-green-800" : "text-yellow-800"}`}>
                {props.heading}
            </strong>
            <span>{props.message}</span>
        </div>
    );
}
