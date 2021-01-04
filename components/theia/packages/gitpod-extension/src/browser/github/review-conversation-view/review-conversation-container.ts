/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { interfaces, Container } from "inversify";
import { createTreeContainer, TreeWidget, TreeImpl, Tree, TreeModelImpl, TreeModel } from "@theia/core/lib/browser";
import { MarkerOptions } from "@theia/markers/lib/browser/marker-tree";
import { ReviewConversationMarker } from "../review-conversation";
import { ReviewConversationTree } from "./review-conversation-tree";
import { ReviewConversationWidget } from "./review-conversation-widget";
import { ReviewConversationTreeModel } from "./review-conversation-tree-model";

export function createReviewConversationContainer(parent: interfaces.Container): Container {
    const child = createTreeContainer(parent);

    child.bind<MarkerOptions>(MarkerOptions).toConstantValue({
        kind: ReviewConversationMarker.kind
    });
    child.unbind(TreeImpl);
    child.bind(ReviewConversationTree).toSelf();
    child.rebind(Tree).toService(ReviewConversationTree);

    child.unbind(TreeModelImpl);
    child.bind(ReviewConversationTreeModel).toSelf();
    child.rebind(TreeModel).toService(ReviewConversationTreeModel);

    child.unbind(TreeWidget);
    child.bind(ReviewConversationWidget).toSelf();

    return child;
}

export function createRequestConversationWidget(parent: interfaces.Container): ReviewConversationWidget {
    return createReviewConversationContainer(parent).get(ReviewConversationWidget);
}