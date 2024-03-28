package io.gitpod.toolbox.components

import com.jetbrains.toolbox.gateway.ui.UiField
import com.jetbrains.toolbox.gateway.ui.UiPage
import java.util.function.BiConsumer
import java.util.function.Function

abstract class AbstractUiPage : UiPage {
    private var stateGetter: Function<UiField, *>? = null

    override fun setStateAccessor(setter: BiConsumer<UiField, Any>?, getter: Function<UiField, *>?) {
        super.setStateAccessor(setter, getter)
        stateGetter = getter
    }

    fun <T> getFieldValue(field: UiField): T? {
        @Suppress("UNCHECKED_CAST")
        return stateGetter?.apply(field) as T?
    }
}