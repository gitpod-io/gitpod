package io.gitpod.toolbox.components

import com.jetbrains.toolbox.gateway.ui.UiField
import com.jetbrains.toolbox.gateway.ui.UiPage
import java.util.function.BiConsumer
import java.util.function.Consumer
import java.util.function.Function

abstract class AbstractUiPage : UiPage {
    private var stateSetter: BiConsumer<UiField, Any>? = null
    private var stateGetter: Function<UiField, *>? = null
    private var resultSetter: Consumer<Any>? = null
    private var errorSetter: Consumer<String>? = null

    @Suppress("UNCHECKED_CAST")
    fun <T> getFieldValue(field: UiField) = stateGetter?.apply(field) as T?
    fun setActionResultMessage(result: Any) = resultSetter?.accept(result)
    fun setActionErrorMessage(error: String) = errorSetter?.accept(error)

    override fun setStateAccessor(setter: BiConsumer<UiField, Any>?, getter: Function<UiField, *>?) {
        super.setStateAccessor(setter, getter)
        stateGetter = getter
        stateSetter = setter
    }

    override fun setActionResultAccessor(setter: Consumer<Any>?) {
        super.setActionResultAccessor(setter)
        resultSetter = setter
    }


    override fun setActionErrorNotifier(notifier: Consumer<String>?) {
        super.setActionErrorNotifier(notifier)
        errorSetter = notifier
    }
}