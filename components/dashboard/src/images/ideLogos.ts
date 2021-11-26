/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */
import goland from './golandLogo.svg';
import intellijIdea from './intellijIdeaLogo.svg';
import vscode from './vscode.svg';
import vscodeInsiders from './vscodeInsiders.svg';

const ideLogos: {[key:string]: string} = {
    "vscode": vscode,
    "vscode-insiders":vscodeInsiders,
    "intellij-idea": intellijIdea,
    "goland": goland,
}

export default ideLogos;
