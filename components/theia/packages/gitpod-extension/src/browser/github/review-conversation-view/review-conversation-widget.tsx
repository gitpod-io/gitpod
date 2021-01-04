/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, postConstruct } from "inversify";
import { TreeWidget, TreeNode, TreeModel, NodeProps, ExpandableTreeNode } from "@theia/core/lib/browser";
import { ReviewConversationMarker } from "../review-conversation";
import { MarkerInfoNode, MarkerNode } from "@theia/markers/lib/browser/marker-tree";
import { ConversationNode, CommenteNode } from "./review-conversation-tree";
import * as React from 'react';

@injectable()
export class ReviewConversationWidget extends TreeWidget {

    static label = 'Review Conversations';

    @postConstruct()
    protected init(): void {
        super.init();
        this.id = ReviewConversationMarker.kind
        this.title.label = ReviewConversationWidget.label;
        this.title.iconClass = 'icon-comment-discussion';
        this.title.closable = true;
        this.addClass('theia-marker-container');

        this.addClipboardListener(this.node, 'copy', e => this.handleCopy(e));
    }

    storeState(): object {
        return {};
    }
    restoreState(oldState: object): void {
        // no-op
    }

    protected handleCopy(event: ClipboardEvent): void {
        const node = this.model.selectedNodes[0];
        if (!node) {
            return;
        }
        if (MarkerNode.is(node) && event.clipboardData != null) {
            const uri = node.uri;
            if (!event.clipboardData) {
                console.error(`Browser ${window.navigator.userAgent} doesn't support clipboardData`);
                return;
            }
            event.clipboardData.setData('text/plain', uri.toString());
            event.preventDefault();
        }
    }

    protected renderTree(model: TreeModel): React.ReactNode {
        return super.renderTree(model) || <div className='noMarkers' >'No review conversations have been detected in the workspace so far.'</div>;
    }

    protected renderCaption(node: TreeNode, props: NodeProps): React.ReactNode {
        if (CommenteNode.is(node)) {
            return this.decorateCommentNode(node);
        }
        if (MarkerInfoNode.is(node)) {
            return this.decorateMarkerFileNode(node);
        }
        return 'caption';
    }

    protected decorateMarkerFileNode(node: MarkerInfoNode): React.ReactNode {
        return <div className='markerFileNode'>
            <div className={(node.icon || '') + ' file-icon'}>{node.name}</div>
            <div className='path'>{node.description || ''}</div>
            <div className='counter'>{node.numberOfMarkers.toString()}</div>
        </div>;
    }

    protected decorateCommentNode(node: CommenteNode): React.ReactNode {
        const { comment } = node;
        return <div className='markerNode'>
            {comment.raw.author && <div className='owner'>{'[' + comment.raw.author.login + ']'}</div>}
            <div className='message'>{comment.raw.body}</div>
        </div>;
    }

    protected isExpandable(node: TreeNode): node is ExpandableTreeNode {
        if (ConversationNode.is(node)) {
            return node.conversation.comments.length > 1;
        }
        return super.isExpandable(node);
    }

}