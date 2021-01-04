/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { UriSelection } from "@theia/core";
import { ExpandableTreeNode, SelectableTreeNode, CompositeTreeNode, TreeNode } from "@theia/core/lib/browser";
import { MarkerTree, MarkerOptions, MarkerInfoNode, MarkerNode } from "@theia/markers/lib/browser/marker-tree";
import { ReviewConversation, ReviewComment, ReviewConversationManager } from "../review-conversation";
import { Marker } from "@theia/markers/lib/common/marker";

@injectable()
export class ReviewConversationTree extends MarkerTree<ReviewConversation> {

    constructor(
        @inject(ReviewConversationManager) protected readonly conversationManager: ReviewConversationManager,
        @inject(MarkerOptions) protected readonly markerOptions: MarkerOptions
    ) {
        super(conversationManager, markerOptions)
    }

    async resolveChildren(parent: CompositeTreeNode): Promise<TreeNode[]> {
        if (ConversationNode.is(parent)) {
            return this.getCommentNodes(parent);
        }
        return super.resolveChildren(parent);
    }

    protected createMarkerNode(marker: Marker<ReviewConversation>, index: number, parent: MarkerInfoNode): ConversationNode {
        const { uri } = parent;
        const conversation = marker.data;
        const comment = conversation.comments[0];
        const id = comment.raw.id;
        const node = this.getNode(id);
        if (ConversationNode.is(node)) {
            node.marker = marker;
            node.comment = comment;
            node.conversation = conversation;
            return node;
        }
        return {
            id,
            name: 'conversation',
            parent,
            selected: false,
            expanded: false,
            children: [],
            uri,
            comment,
            conversation,
            marker
        };
    }

    protected getCommentNodes(parent: ConversationNode): CommenteNode[] {
        return parent.conversation.comments.slice(1).map(comment => this.getCommentNode(comment, parent));
    }

    protected getCommentNode(comment: ReviewComment, parent: ConversationNode): CommenteNode {
        const { uri } = parent;
        const id = comment.raw.id;
        const node = this.getNode(id);
        if (CommenteNode.is(node)) {
            node.comment = comment;
            return node;
        }
        return {
            id,
            name: 'comment',
            parent,
            selected: false,
            uri,
            comment
        };
    }
}

export interface CommenteNode extends UriSelection, SelectableTreeNode {
    comment: ReviewComment
}
export namespace CommenteNode {
    export function is(node: TreeNode | undefined): node is CommenteNode {
        return UriSelection.is(node) && SelectableTreeNode.is(node) && 'comment' in node;
    }
}

export interface ConversationNode extends MarkerNode, CommenteNode, ExpandableTreeNode {
    conversation: ReviewConversation
}
export namespace ConversationNode {
    export function is(node: TreeNode | undefined): node is ConversationNode {
        return CommenteNode.is(node) && ExpandableTreeNode.is(node) && 'conversation' in node;
    }
}

