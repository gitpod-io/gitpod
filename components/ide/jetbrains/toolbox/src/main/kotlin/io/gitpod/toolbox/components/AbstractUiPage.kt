// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.components

import com.jetbrains.toolbox.api.ui.components.UiField
import com.jetbrains.toolbox.api.ui.components.UiPage

abstract class AbstractUiPage : UiPage {
    private var stateAccessor: UiPage.UiFieldStateAccessor? = null

    @Suppress("UNCHECKED_CAST")
    fun <T> getFieldValue(field: UiField) = stateAccessor?.get(field) as T?

    override fun setStateAccessor(stateAccessor: UiPage.UiFieldStateAccessor?) {
        super.setStateAccessor(stateAccessor)
        this.stateAccessor = stateAccessor
    }
}

class EmptyUiPageWithTitle(private val title: String) : UiPage {
    override fun getFields(): MutableList<UiField> = mutableListOf()
    override fun getTitle() = title
}
