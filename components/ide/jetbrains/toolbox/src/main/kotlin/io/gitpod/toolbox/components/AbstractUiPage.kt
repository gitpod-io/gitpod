// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.components

import com.jetbrains.toolbox.gateway.ui.UiField
import com.jetbrains.toolbox.gateway.ui.UiPage
import java.util.function.BiConsumer
import java.util.function.Consumer
import java.util.function.Function

abstract class AbstractUiPage : UiPage {
    private var stateSetter: BiConsumer<UiField, Any>? = null
    private var stateGetter: Function<UiField, *>? = null
    private var errorSetter: Consumer<Throwable>? = null

    @Suppress("UNCHECKED_CAST")
    fun <T> getFieldValue(field: UiField) = stateGetter?.apply(field) as T?
    fun setFieldValue(field: UiField, value: Any) = stateSetter?.accept(field, value)
    fun setActionErrorMessage(error: String) = errorSetter?.accept(Throwable(error))

    override fun setStateAccessor(setter: BiConsumer<UiField, Any>?, getter: Function<UiField, *>?) {
        super.setStateAccessor(setter, getter)
        stateGetter = getter
        stateSetter = setter
    }

    override fun setActionErrorNotifier(notifier: Consumer<Throwable>?) {
        super.setActionErrorNotifier(notifier)
        errorSetter = notifier
    }
}
