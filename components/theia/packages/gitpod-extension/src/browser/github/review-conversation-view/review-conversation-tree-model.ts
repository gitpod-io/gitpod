/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { TreeNode } from "@theia/core/lib/browser";
import { MarkerTreeModel } from "@theia/markers/lib/browser/marker-tree-model"
import { GitHubEditorManager } from "../github-editor";
import { CommenteNode } from "./review-conversation-tree";

@injectable()
export class ReviewConversationTreeModel extends MarkerTreeModel {

    @inject(GitHubEditorManager)
    protected readonly editorManager: GitHubEditorManager;

    protected async doOpenNode(node: TreeNode): Promise<void> {
        if (CommenteNode.is(node)) {
            const widget = await this.editorManager.open(node.uri, node.comment.lineNumber, node.comment.operation);
            if (widget) {
                node.comment.reveal();
            }
        } else {
            super.doOpenNode(node);
        }
    }

}