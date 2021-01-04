/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as os from "os";
import * as yaml from "yaml";

const yamlTypes = require('yaml/types');
yamlTypes.strOptions.fold.lineWidth = -1;
yamlTypes.strOptions.fold.minContentWidth = 0;


type YamlAstNode = yaml.ast.AstNode & YamlNode;
interface YamlNode extends yaml.ast.Node {
    getIn(keys: (number | string)[]): YamlAstNode | undefined | null
    get(key: number | string, keepScalar: true): YamlAstNode | undefined | null
    get(key: number | string, keepScalar?: boolean): YamlAstNode | string | undefined | null
}
type YamlDocument = yaml.ast.Document & YamlNode;

function getNodeIndent(node: yaml.ast.AstNode | yaml.ast.Document | null): number {
    const cstNode = node && node.cstNode;
    const context = cstNode && cstNode.context;
    return context ? context.indent : -1;
}

export class GitpodPluginModel {

    private readonly document: YamlDocument;

    constructor(content: string) {
        this.document = <YamlDocument>yaml.parseDocument(content, { keepCstNodes: true });
    }

    toString(): string {
        return this.document.cstNode!.toString();
    }

    add(...extensions: string[]): boolean {
        if (!extensions.length) return false;

        let indent = -1;
        const uniqueExtensions = new Set(extensions.map(uri => uri.trim()));
        const toUriParts = (...keys: string[]) => {
            const parts: string[] = [];
            if (!uniqueExtensions.size) {
                return parts;
            }
            let indentStr = '';
            for (let i = 0; i < indent; ++i) indentStr += ' ';
            for (const key of keys) {
                parts.push(`${indentStr}${key}:`);
                indentStr += '  ';
            }
            for (const uri of uniqueExtensions) {
                parts.push(`${indentStr}- ${uri}`);
            }
            return parts;
        }

        indent = getNodeIndent(this.document);
        const vscodeNode = this.document.get('vscode', true);
        if (vscodeNode === null) {
            const contents = this.document.contents;
            if (contents && contents.type === 'MAP') {
                const vscodeKeyIndex = contents.items.findIndex(i => !!i.key && ('value' in i.key) && i.key.value === 'vscode');
                const item = contents.items[vscodeKeyIndex];
                if (item && item.key && item.key.cstNode) {
                    this.replace(item.key.cstNode, toUriParts('vscode', 'extensions'));

                    const nextKeyIndex = contents.items[vscodeKeyIndex + 1];
                    if (item.key.cstNode.context && nextKeyIndex && nextKeyIndex.key && nextKeyIndex.key.cstNode) {
                        const parent = item.key.cstNode.context.parent as yaml.cst.Map;
                        if (parent.type === 'MAP') {
                            const startIndex = parent.items.indexOf(item.key.cstNode as any) + 1;
                            const endIndex = parent.items.indexOf(nextKeyIndex.key.cstNode as any) - 1;
                            for (let i = startIndex; i < endIndex; i++) {
                                this.removeNode(parent.items[i]);
                            }
                        }
                    }
                    return true;
                }
            }
            return false;
        }
        if (vscodeNode === undefined) {
            return this.append(this.document.cstNode, toUriParts('vscode', 'extensions'));
        }
        indent = getNodeIndent(vscodeNode) + 2;
        if (vscodeNode.type !== 'MAP') {
            return this.replace(vscodeNode.cstNode, toUriParts('extensions'));
        }
        const extensionsNode = vscodeNode.get('extensions', true);
        if (extensionsNode === null) {
            if (vscodeNode && vscodeNode.type === 'MAP') {
                const item = vscodeNode.items.find(i => !!i.key && ('value' in i.key) && i.key.value === 'extensions');
                if (item && item.key && item.key.cstNode) {
                    this.replace(item.key.cstNode, toUriParts('extensions'));

                    if (item.key.cstNode.context) {
                        const parent = item.key.cstNode.context.parent as yaml.cst.Map;
                        if (parent.type === 'MAP') {
                            const startIndex = parent.items.indexOf(item.key.cstNode as any) + 1;
                            for (let i = startIndex; i < parent.items.length; i++) {
                                this.removeNode(parent.items[i]);
                            }
                        }
                    }
                    return true;
                }
            }
            return false;
        }
        indent -= 2;
        if (extensionsNode === undefined) {
            return this.append(vscodeNode.cstNode, toUriParts('extensions'));
        }
        indent = getNodeIndent(extensionsNode) + 2;
        if (extensionsNode.type !== 'SEQ') {
            return this.replace(extensionsNode.cstNode, toUriParts());
        }
        indent -= 2;
        for (let i = 0; i < extensionsNode.items.length; i++) {
            const extension = extensionsNode.get(i);
            if (typeof extension === 'string') {
                uniqueExtensions.delete(extension.trim());
            }
            const extensionIndent = getNodeIndent(extensionsNode.items[i]);
            if (extensionIndent > indent) {
                indent = extensionIndent;
            }
        }
        return this.append(extensionsNode.cstNode, toUriParts());
    }

    protected append(cstNode: yaml.cst.Node | undefined, parts: string[]): boolean {
        if (!cstNode || !parts.length) return false;
        if (cstNode.rawValue) {
            parts.unshift(cstNode.rawValue);
        }
        return this.replace(cstNode, parts);
    }

    protected replace(cstNode: yaml.cst.Node | undefined | null, parts: string[]): boolean {
        if (!cstNode || !parts.length) return false;

        const { context } = cstNode;
        if (!context) return false;

        if (context.atLineStart === false) {
            parts.unshift('');
        }
        if (context.indent > -1 && parts[0]) {
            for (let i = -1; i < context.indent; i++) {
                if (parts[0].startsWith('  ')) {
                    parts[0] = parts[0].substr(2);
                }
            }
        }
        cstNode.value = parts.join(os.EOL);
        return true;
    }

    protected removeNode(cstNode: yaml.cst.Node | undefined | null): boolean {
        if (!cstNode) {
            return false;
        }
        cstNode.value = '';
        if (cstNode.context) {
            cstNode.context.indent = -1;
        }
        return true;
    }

    remove(...extensions: string[]): boolean {
        if (!extensions.length) return false;

        const extensionsNode = this.document.getIn(['vscode', 'extensions']);
        if (!extensionsNode || extensionsNode.type !== 'SEQ') return false;

        const { cstNode } = extensionsNode;
        if (!cstNode) return false;

        const toDelete = new Set(extensions.map(uri => uri.trim()));
        let deleted = 0;
        let firstDeleted = false;
        for (let i = 0; i < extensionsNode.items.length; i++) {
            const item = cstNode.items[i];
            const extension = extensionsNode.get(i);
            if (typeof extension === 'string' && toDelete.has(extension.trim())) {
                deleted++;
                if (i === 0) {
                    firstDeleted = true;
                }
                this.removeNode(item);
            } else if (item.context && firstDeleted) {
                item.context.indent = -1;
                firstDeleted = false;
            }
        }
        if (deleted === extensionsNode.items.length) {
            const contents = this.document.contents;
            if (contents && contents.type === 'MAP') {
                const vscodeKeyIndex = contents.items.findIndex(i => !!i.key && ('value' in i.key) && i.key.value === 'vscode');
                const item = contents.items[vscodeKeyIndex];
                if (item && item.key && item.key.cstNode && item.key.cstNode.context) {
                    const parent = item.key.cstNode.context.parent as yaml.cst.Map;
                    if (parent.type === 'MAP') {
                        const startIndex = parent.items.indexOf(item.key.cstNode as any);
                        const nextKeyIndex = contents.items[vscodeKeyIndex + 1];
                        let endIndex = parent.items.length;
                        if (nextKeyIndex && nextKeyIndex.key && nextKeyIndex.key.cstNode) {
                            endIndex = parent.items.indexOf(nextKeyIndex.key.cstNode as any);
                        }
                        for (let i = startIndex; i < endIndex; i++) {
                            this.removeNode(parent.items[i]);
                        }
                    }
                }
            }
        }
        return deleted > 0;
    }

}