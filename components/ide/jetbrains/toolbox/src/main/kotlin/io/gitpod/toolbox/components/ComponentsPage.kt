// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.components

import com.jetbrains.toolbox.gateway.ui.*
import com.jetbrains.toolbox.gateway.ui.AutocompleteTextField.AutocompleteItem
import com.jetbrains.toolbox.gateway.ui.AutocompleteTextField.MenuItem
import org.slf4j.LoggerFactory

class ComponentsPage() : AbstractUiPage() {
    private val logger = LoggerFactory.getLogger(javaClass)
    override fun getFields(): MutableList<UiField> {
        val item: AutocompleteItem = MenuItem("item1", "group1", "group desc") {
            logger.info("selected item1")
        }
        val item2: AutocompleteItem = MenuItem("item2", "group1", "group desc") {
            logger.info("selected item1")
        }
        val item3: AutocompleteItem = MenuItem("item3", "group2", "group desc") {
            logger.info("selected item3")
        }
        return mutableListOf(
            AutocompleteTextField("AutocompleteTextField", "", mutableListOf(item, item2, item3), null, null),
            CheckboxField(false, "Checkbox"),
            ComboBoxField(
                "ComboBoxField",
                "s1",
                mutableListOf(ComboBoxField.LabelledValue("s1", "s1"), ComboBoxField.LabelledValue("s2", "s2"))
            ),
            LabelField("LabelField"),
            RadioButtonField(false, "RadioButtonField2", "group_1"),
            RowGroup(
                RowGroup.RowField(RadioButtonField(true, "RadioButtonField-2", "group_1"), RowGroup.RowFieldSettings(1.0f)),
                RowGroup.RowField(RadioButtonField(true, "RadioButtonField-1", "group_1"), RowGroup.RowFieldSettings(1.0f)),
            ),
            RowGroup(
                RowGroup.RowField(LabelField("LabelField-1"), RowGroup.RowFieldSettings(1.0f)),
                RowGroup.RowField(LabelField("LabelField-2"), RowGroup.RowFieldSettings(1.0f)),
            ),
            TextField("TextField", "", TextType.Password),
            LinkField("LinkField", "https://gitpod.io/docs"),
        )
    }

    override fun getActionButtons(): MutableList<ActionDescription> {
        return mutableListOf(SimpleButton("Button") {
            logger.info("button clicked")
        }, object : RunnableActionDescription {
            override fun getLabel() = "Dangerous Button"

            override fun run() {
                logger.info("danger")
            }

            override fun isDangerous() = true
        })
    }

    override fun getTitle(): String {
        return "View components"
    }
}
