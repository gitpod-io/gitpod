/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as os from "os";
import * as assert from 'assert';
import { suite, test } from "mocha-typescript"
import { GitpodPluginModel } from './gitpod-plugin-model';

function toContent(...parts: string[]): string {
    return parts.join(os.EOL);
}

function assertContent(model: GitpodPluginModel, ...parts: string[]): void {
    assert.deepStrictEqual(
        model.toString().trim().split(os.EOL).map(part => part.trimRight()),
        parts.map(part => part.trimRight())
    );
}

@suite
export class GitpodPluginModelTest {

    @test
    testAdd_01(): void {
        const model = new GitpodPluginModel('');
        assert.ok(model.add('file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix'), String(model));
        assertContent(model,
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix'
        );
    }

    @test
    testAdd_02(): void {
        const model = new GitpodPluginModel(toContent(
            'ports:',
            '  - 3000'
        ));
        assert.ok(model.add('file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix'), String(model));
        assertContent(model,
            'ports:',
            '  - 3000',
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix'
        );
    }

    @test
    testAdd_03(): void {
        const model = new GitpodPluginModel(toContent(
            'vscode:',
            '  - lalala'
        ));
        assert.ok(model.add('file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix'), String(model));
        assertContent(model,
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix'
        );
    }

    @test
    testAdd_04(): void {
        const model = new GitpodPluginModel(toContent(
            'vscode: true'
        ));
        assert.ok(model.add('file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix'), String(model));
        assertContent(model,
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix'
        );
    }

    @test
    testAdd_05(): void {
        const model = new GitpodPluginModel(toContent(
            'vscode:',
            '  extensions:',
        ));
        assert.ok(model.add('file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'), String(model));
        assertContent(model,
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'
        );
    }

    @test
    testAdd_06(): void {
        const model = new GitpodPluginModel(toContent(
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix'
        ));
        assert.ok(model.add('file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'), String(model));
        assertContent(model,
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'
        );
    }

    @test
    testAdd_07(): void {
        const model = new GitpodPluginModel(toContent(
            'vscode:',
            '  extensions: true'
        ));
        assert.ok(model.add('file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'), String(model));
        assertContent(model,
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'
        );
    }

    @test
    testAdd_08(): void {
        const model = new GitpodPluginModel(toContent(
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix'
        ));
        assert.strictEqual(model.add('file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix'), false, String(model));
        assertContent(model,
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix'
        );
    }

    @test
    testAdd_09(): void {
        const model = new GitpodPluginModel(toContent(
            'vscode:',
            '  extensions:',
        ));
        assert.ok(model.add(
            'file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix',
            'file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'
        ), String(model));
        assertContent(model,
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'
        );
    }

    @test
    testAdd_10(): void {
        const model = new GitpodPluginModel(toContent(
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'
        ));
        assert.strictEqual(model.add(
            'file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix',
            'file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'
        ), false, String(model));
        assertContent(model,
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'
        );
    }

    @test
    testAdd_11(): void {
        const model = new GitpodPluginModel(toContent(
            'vscode:',
            '    extensions:',
            '        - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix'
        ));
        assert.ok(model.add(
            'file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'
        ), String(model));
        assertContent(model,
            'vscode:',
            '    extensions:',
            '        - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix',
            '        - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'
        );
    }

    @test
    testAdd_12(): void {
        const model = new GitpodPluginModel(toContent(
            'privileged: true',
            'vscode:',
            '  extensions:',
            '    ',
            'privileged: false'
        ));
        assert.ok(model.add('file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'), String(model));
        assertContent(model,
            'privileged: true',
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix',
            '',
            'privileged: false'
        );
    }

    @test
    testAdd_13(): void {
        const model = new GitpodPluginModel(toContent(
            'privileged: true',
            'vscode:',
            '    ',
            'privileged: false'
        ));
        assert.ok(model.add('file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'), String(model));
        assertContent(model,
            'privileged: true',
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix',
            'privileged: false'
        );
    }

    @test
    testRemove_01(): void {
        const model = new GitpodPluginModel(toContent(
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.2.vsix',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.3.vsix',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix'
        ));
        assert.ok(model.remove('file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix'), String(model));
        assertContent(model,
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.2.vsix',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.3.vsix',
        );
    }

    @test
    testRemove_02(): void {
        const model = new GitpodPluginModel(toContent(
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.2.vsix',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix',
            '    - file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.3.vsix',

        ));
        assert.ok(model.remove('file:///workspace/gitpod/extensions/ms-vscode.Go-0.9.2.vsix'), String(model));
        assertContent(model,
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.2.vsix',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.3.vsix',
        );
    }

    @test
    testRemove_03(): void {
        const model = new GitpodPluginModel(toContent(
            'privileged: true',
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix',
            'privileged: false'

        ));
        assert.ok(model.remove('file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'), String(model));
        assertContent(model,
            'privileged: true',
            'privileged: false'
        );
    }

    @test
    testRemove_04(): void {
        const model = new GitpodPluginModel(toContent(
            'privileged: true',
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix',
            'privileged: false'

        ));
        assert.ok(model.remove('file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'), String(model));
        assertContent(model,
            'privileged: true',
            'privileged: false'
        );
    }

    @test
    testRemove_05(): void {
        const model = new GitpodPluginModel(toContent(
            'privileged: true',
            'vscode:',
            '  extensions:',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix',
            '    - file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'

        ));
        assert.ok(model.remove('file:///workspace/gitpod/extensions/rust-lang.Go-0.6.1.vsix'), String(model));
        assertContent(model,
            'privileged: true'
        );
    }

}