/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as assert from 'assert';
import { suite, test } from "mocha-typescript"
import { GitHubData } from './github-data';
import { GitHubFile } from './github-file';
import { PullRequestReviewComment } from './github-protocol';

@suite
export class GitHubDataTest {
    static before() {
        // guarantees that DiffLine.content? is set
        GitHubFile.computeDiffLineWithContent = true;
    }

    readonly filename = 'Foo.js';

    protected asserConversations(expectations: {
        operation: string,
        id: string,
        originalLineNumber: number | undefined
    }[], conversations: GitHubData.Conversation[], message?: string): void {
        assert.deepEqual(expectations, conversations.map(({ operation, originalLineNumber, comments }) => ({
            operation, originalLineNumber,
            id: comments[0].id
        })), message);
    }

    protected assertHunks(expectation: string, startLineNumber: number, endLineNumber: number, kind: GitHubFile.Kind, data: GitHubData, path = this.filename): void {
        const result: string[] = [];
        for (let lineNumber = startLineNumber; lineNumber < endLineNumber; lineNumber++) {
            const line = data.getDiffLine(kind, path, lineNumber);
            if (line) {
                result.push(lineNumber + ' -> ' + line.position + ': ' + line.content!);
            }
        }
        assert.equal(expectation, '\n' + result.join('\n') + '\n');
    }

    protected createSingleHunkData(): GitHubData {
        const data = new GitHubData();
        data.pushFile({
            filename: this.filename,
            patch: `@@ -253,17 +257,13 @@ export class ConnectionStatusImpl implements ConnectionStatus {
 
    constructor(
        protected readonly props: { readonly threshold: number },
-        public readonly state: ConnectionState = ConnectionState.ONLINE,
+        public readonly state: ConnectionState = ConnectionState.INITIAL,
        protected readonly history: boolean[] = []) {
    }
 
    next(success: boolean): ConnectionStatusImpl {
        const newHistory = this.updateHistory(success);
-        // Initial optimism.
-        let online = true;
-        if (newHistory.length > this.props.threshold) {
-            online = newHistory.slice(-this.props.threshold).some(s => s);
-        }
+        const online = newHistory.slice(-this.props.threshold).some(s => s);
        // Ideally, we do not switch back to online if we see any "true" items but, let's say, after three consecutive "true"s.
        return new ConnectionStatusImpl(this.props, online ? ConnectionState.ONLINE : ConnectionState.OFFLINE, newHistory);
    }`});
        return data
    }

    @test
    testOriginalSingleHunk(): void {
        this.assertHunks(`
253 -> 1:  
254 -> 2:     constructor(
255 -> 3:         protected readonly props: { readonly threshold: number },
256 -> 4: -        public readonly state: ConnectionState = ConnectionState.ONLINE,
257 -> 6:         protected readonly history: boolean[] = []) {
258 -> 7:     }
259 -> 8:  
260 -> 9:     next(success: boolean): ConnectionStatusImpl {
261 -> 10:         const newHistory = this.updateHistory(success);
262 -> 11: -        // Initial optimism.
263 -> 12: -        let online = true;
264 -> 13: -        if (newHistory.length > this.props.threshold) {
265 -> 14: -            online = newHistory.slice(-this.props.threshold).some(s => s);
266 -> 15: -        }
267 -> 17:         // Ideally, we do not switch back to online if we see any "true" items but, let's say, after three consecutive "true"s.
268 -> 18:         return new ConnectionStatusImpl(this.props, online ? ConnectionState.ONLINE : ConnectionState.OFFLINE, newHistory);
269 -> 19:     }
`, 250, 275, 'original', this.createSingleHunkData());
    }

    @test
    testModifiedSingleHunk(): void {
        this.assertHunks(`
257 -> 1:  
258 -> 2:     constructor(
259 -> 3:         protected readonly props: { readonly threshold: number },
260 -> 5: +        public readonly state: ConnectionState = ConnectionState.INITIAL,
261 -> 6:         protected readonly history: boolean[] = []) {
262 -> 7:     }
263 -> 8:  
264 -> 9:     next(success: boolean): ConnectionStatusImpl {
265 -> 10:         const newHistory = this.updateHistory(success);
266 -> 16: +        const online = newHistory.slice(-this.props.threshold).some(s => s);
267 -> 17:         // Ideally, we do not switch back to online if we see any "true" items but, let's say, after three consecutive "true"s.
268 -> 18:         return new ConnectionStatusImpl(this.props, online ? ConnectionState.ONLINE : ConnectionState.OFFLINE, newHistory);
269 -> 19:     }
`, 250, 275, 'modified', this.createSingleHunkData());
    }

    protected createMultiHunkData(): GitHubData {
        const data = new GitHubData();
        data.pushFile({
            filename: this.filename,
            patch: `@@ -31,6 +31,8 @@ export class BottomPanel {
 
    waitForTerminal() {
        this.driver.waitForExist('.p-Widget div.terminal.xterm');
+        // Wait for animations to finish
+        this.driver.pause(200);
    }
 
    isProblemsViewVisible(): boolean {
@@ -39,10 +41,12 @@ export class BottomPanel {
 
    waitForProblemsView() {
        this.driver.waitForExist('.p-Widget div.theia-marker-container');
+        // Wait for animations to finish
+        this.driver.pause(200);
    }
 
    closeCurrentView() {
-        this.driver.click('#theia-bottom-content-panel .p-TabBar-tab.theia-mod-current .p-TabBar-tabCloseIcon');
+        this.driver.click('#theia-bottom-content-panel .p-TabBar-tab.theia-mod-current .p-TabBar-tabCloseIcon');
    }
 
}`});
        return data;
    }

    @test
    testOriginalMultiHunk(): void {
        this.assertHunks(`
31 -> 1:  
32 -> 2:     waitForTerminal() {
33 -> 3:         this.driver.waitForExist('.p-Widget div.terminal.xterm');
34 -> 6:     }
35 -> 7:  
36 -> 8:     isProblemsViewVisible(): boolean {
39 -> 10:  
40 -> 11:     waitForProblemsView() {
41 -> 12:         this.driver.waitForExist('.p-Widget div.theia-marker-container');
42 -> 15:     }
43 -> 16:  
44 -> 17:     closeCurrentView() {
45 -> 18: -        this.driver.click('#theia-bottom-content-panel .p-TabBar-tab.theia-mod-current .p-TabBar-tabCloseIcon');
46 -> 20:     }
47 -> 21:  
`, 25, 55, 'original', this.createMultiHunkData());
    }

    @test
    testModifiedMultiHunk(): void {
        this.assertHunks(`
31 -> 1:  
32 -> 2:     waitForTerminal() {
33 -> 3:         this.driver.waitForExist('.p-Widget div.terminal.xterm');
34 -> 4: +        // Wait for animations to finish
35 -> 5: +        this.driver.pause(200);
36 -> 6:     }
37 -> 7:  
38 -> 8:     isProblemsViewVisible(): boolean {
41 -> 10:  
42 -> 11:     waitForProblemsView() {
43 -> 12:         this.driver.waitForExist('.p-Widget div.theia-marker-container');
44 -> 13: +        // Wait for animations to finish
45 -> 14: +        this.driver.pause(200);
46 -> 15:     }
47 -> 16:  
48 -> 17:     closeCurrentView() {
49 -> 19: +        this.driver.click('#theia-bottom-content-panel .p-TabBar-tab.theia-mod-current .p-TabBar-tabCloseIcon');
50 -> 20:     }
51 -> 21:  
`, 25, 55, 'modified', this.createMultiHunkData());
    }

    protected createPushCommentData(): GitHubData {
        const data = new GitHubData();
        data.pushFile({
            filename: this.filename,
            patch: `@@ -14,24 +14,29 @@ export class DiffHunkCollection {
    }
    pushFile(file: ReposCompareCommitsResult.File): void {
        const path = file.filename;
+        let position = 1;
        for (const diff of parsePatch(file.patch)) {
            for (const hunk of diff.hunks) {
                this.original.push(path, {
+                    position,
                    start: hunk.oldStart,
                    length: hunk.oldLines,
                    lines: hunk.lines
                });
                this.modified.push(path, {
+                    position,
                    start: hunk.newStart,
                    length: hunk.newLines,
                    lines: hunk.lines
                });
+                position += hunk.lines.length + 1;
            }
        }
    }
 }
 export namespace DiffHunkCollection {
    export interface Hunk {
+        position: number,
        start: number,
        length: number,
        lines: string[]
@@ -77,7 +82,7 @@ export namespace DiffHunkCollection {
            if (!hunk) {
                return undefined;
            }
-            let position = 1;
+            let position = hunk.position;
            let lines = lineNumber - hunk.start + 1;
            for (const content of hunk.lines) {
                if (!content.startsWith(this.reverseOperation)) {`});
        return data;
    }

    @test
    testOriginalPushCommentHunk(): void {
        this.assertHunks(`
14 -> 1:     }
15 -> 2:     pushFile(file: ReposCompareCommitsResult.File): void {
16 -> 3:         const path = file.filename;
17 -> 5:         for (const diff of parsePatch(file.patch)) {
18 -> 6:             for (const hunk of diff.hunks) {
19 -> 7:                 this.original.push(path, {
20 -> 9:                     start: hunk.oldStart,
21 -> 10:                     length: hunk.oldLines,
22 -> 11:                     lines: hunk.lines
23 -> 12:                 });
24 -> 13:                 this.modified.push(path, {
25 -> 15:                     start: hunk.newStart,
26 -> 16:                     length: hunk.newLines,
27 -> 17:                     lines: hunk.lines
28 -> 18:                 });
29 -> 20:             }
30 -> 21:         }
31 -> 22:     }
32 -> 23:  }
33 -> 24:  export namespace DiffHunkCollection {
34 -> 25:     export interface Hunk {
35 -> 27:         start: number,
36 -> 28:         length: number,
37 -> 29:         lines: string[]
77 -> 31:             if (!hunk) {
78 -> 32:                 return undefined;
79 -> 33:             }
80 -> 34: -            let position = 1;
81 -> 36:             let lines = lineNumber - hunk.start + 1;
82 -> 37:             for (const content of hunk.lines) {
83 -> 38:                 if (!content.startsWith(this.reverseOperation)) {
`, 10, 95, 'original', this.createPushCommentData());
    }

    @test
    testModifiedPushCommentHunk(): void {
        this.assertHunks(`
14 -> 1:     }
15 -> 2:     pushFile(file: ReposCompareCommitsResult.File): void {
16 -> 3:         const path = file.filename;
17 -> 4: +        let position = 1;
18 -> 5:         for (const diff of parsePatch(file.patch)) {
19 -> 6:             for (const hunk of diff.hunks) {
20 -> 7:                 this.original.push(path, {
21 -> 8: +                    position,
22 -> 9:                     start: hunk.oldStart,
23 -> 10:                     length: hunk.oldLines,
24 -> 11:                     lines: hunk.lines
25 -> 12:                 });
26 -> 13:                 this.modified.push(path, {
27 -> 14: +                    position,
28 -> 15:                     start: hunk.newStart,
29 -> 16:                     length: hunk.newLines,
30 -> 17:                     lines: hunk.lines
31 -> 18:                 });
32 -> 19: +                position += hunk.lines.length + 1;
33 -> 20:             }
34 -> 21:         }
35 -> 22:     }
36 -> 23:  }
37 -> 24:  export namespace DiffHunkCollection {
38 -> 25:     export interface Hunk {
39 -> 26: +        position: number,
40 -> 27:         start: number,
41 -> 28:         length: number,
42 -> 29:         lines: string[]
82 -> 31:             if (!hunk) {
83 -> 32:                 return undefined;
84 -> 33:             }
85 -> 35: +            let position = hunk.position;
86 -> 36:             let lines = lineNumber - hunk.start + 1;
87 -> 37:             for (const content of hunk.lines) {
88 -> 38:                 if (!content.startsWith(this.reverseOperation)) {
`, 10, 95, 'modified', this.createPushCommentData());
    }

    protected assertComment(data: GitHubData, kind: GitHubFile.Kind, lineNumber: number, expectation: string | undefined): void {
        const comments = data.getComments(kind, this.filename, lineNumber);
        assert.equal(kind + ': ' + expectation, kind + ': ' + (comments && comments[0] && comments[0].id));
    }

    @test
    testPushComment_01(): void {
        const data = this.createPushCommentData();
        data.pushComment(<PullRequestReviewComment>{
            id: 'test',
            path: this.filename,
            position: 31,
            diffHunk: `@@ -77,7 +82,7 @@ export namespace DiffHunkCollection {
            if (!hunk) {`
        });
        this.assertComment(data, 'original', 77, undefined);
        this.assertComment(data, 'modified', 82, 'test');
    }

    @test
    testPushComment_02(): void {
        const data = this.createPushCommentData();
        data.pushComment(<PullRequestReviewComment>{
            id: 'test',
            path: this.filename,
            position: 33,
            diffHunk: `@@ -77,7 +82,7 @@ export namespace DiffHunkCollection {
            if (!hunk) {
                return undefined;
            }` });
        this.assertComment(data, 'original', 79, undefined);
        this.assertComment(data, 'modified', 84, 'test');
    }

    @test
    testPushComment_03(): void {
        const data = this.createPushCommentData();
        data.pushComment(<PullRequestReviewComment>{
            id: 'test',
            path: this.filename,
            position: 34,
            diffHunk: `@@ -77,7 +82,7 @@ export namespace DiffHunkCollection {
            if (!hunk) {
                return undefined;
            }
-            let position = 1;` });
        this.assertComment(data, 'original', 80, 'test');
        this.assertComment(data, 'modified', 85, undefined);
    }

    @test
    testPushComment_04(): void {
        const data = this.createPushCommentData();
        data.pushComment(<PullRequestReviewComment>{
            id: 'test',
            path: this.filename,
            position: 35,
            diffHunk: `@@ -77,7 +82,7 @@ export namespace DiffHunkCollection {
            if (!hunk) {
                return undefined;
            }
-            let position = 1;
+            let position = hunk.position;` });
        this.assertComment(data, 'original', 80, undefined);
        this.assertComment(data, 'modified', 85, 'test');
    }

    @test
    testPushComment_05(): void {
        const data = this.createPushCommentData();
        data.pushComment(<PullRequestReviewComment>{
            id: 'test',
            path: this.filename,
            position: 36,
            diffHunk: `@@ -77,7 +82,7 @@ export namespace DiffHunkCollection {
           if (!hunk) {
               return undefined;
           }
-            let position = 1;
+            let position = hunk.position;
           let lines = lineNumber - hunk.start + 1;` });
        this.assertComment(data, 'original', 81, undefined);
        this.assertComment(data, 'modified', 86, 'test');
    }

    protected createGetConversationsData(): GitHubData {
        const data = new GitHubData();
        data.pushFile({
            filename: this.filename,
            patch: `@@ -1,5 +1,5 @@
 import { Disposable, DisposableCollection, Emitter, Event } from '@theia/core';
-import { GitHubModel } from '../github-model';
+import { GitHubModel, GitHubFile } from '../github-model';
 import { ReviewConversationManager, ReviewConversation } from '../review-conversation';
 
 export class GitHubEditorModel implements Disposable {
@@ -12,7 +12,7 @@ export class GitHubEditorModel implements Disposable {
    readonly newConversation: ReviewConversation;
 
    constructor(
-        readonly orginal: boolean,
+        readonly kind: GitHubFile.Kind,
        readonly path: string,
        readonly lineNumber: number,
        readonly gitHub: GitHubModel,`});
        return data;
    }

    @test
    testOriginalGetConversationsHunk(): void {
        this.assertHunks(`
1 -> 1:  import { Disposable, DisposableCollection, Emitter, Event } from '@theia/core';
2 -> 2: -import { GitHubModel } from '../github-model';
3 -> 4:  import { ReviewConversationManager, ReviewConversation } from '../review-conversation';
4 -> 5:  
5 -> 6:  export class GitHubEditorModel implements Disposable {
12 -> 8:     readonly newConversation: ReviewConversation;
13 -> 9:  
14 -> 10:     constructor(
15 -> 11: -        readonly orginal: boolean,
16 -> 13:         readonly path: string,
17 -> 14:         readonly lineNumber: number,
18 -> 15:         readonly gitHub: GitHubModel,
`, 0, 20, 'original', this.createGetConversationsData());
    }

    @test
    testModifiedGetConversationsHunk(): void {
        this.assertHunks(`
1 -> 1:  import { Disposable, DisposableCollection, Emitter, Event } from '@theia/core';
2 -> 3: +import { GitHubModel, GitHubFile } from '../github-model';
3 -> 4:  import { ReviewConversationManager, ReviewConversation } from '../review-conversation';
4 -> 5:  
5 -> 6:  export class GitHubEditorModel implements Disposable {
12 -> 8:     readonly newConversation: ReviewConversation;
13 -> 9:  
14 -> 10:     constructor(
15 -> 12: +        readonly kind: GitHubFile.Kind,
16 -> 13:         readonly path: string,
17 -> 14:         readonly lineNumber: number,
18 -> 15:         readonly gitHub: GitHubModel,
`, 0, 20, 'modified', this.createGetConversationsData());
    }

    protected pushGetConversationsRemoved(data: GitHubData): void {
        data.pushComment(<PullRequestReviewComment>{
            id: 'removed',
            path: this.filename,
            position: 11,
            diffHunk: `@@ -12,7 +12,7 @@ export class GitHubEditorModel implements Disposable {
    readonly newConversation: ReviewConversation;
 
    constructor(
-        readonly orginal: boolean,` });
    }

    protected pushGetConversationsAdded(data: GitHubData): void {
        data.pushComment(<PullRequestReviewComment>{
            id: 'added',
            path: this.filename,
            position: 12,
            diffHunk: `@@ -77,7 +82,7 @@ export namespace DiffHunkCollection {
        if (!hunk) {
            return undefined;
        }
-            let position = 1;
+            let position = hunk.position;` });
    }

    protected pushGetConversationsUnchanged(data: GitHubData): void {
        data.pushComment(<PullRequestReviewComment>{
            id: 'unchanged',
            path: this.filename,
            position: 10,
            diffHunk: `@@ -77,7 +82,7 @@ export namespace DiffHunkCollection {
        if (!hunk) {
            return undefined;
        }` });
    }

    @test
    testGetConversations_01(): void {
        const data = this.createGetConversationsData();
        this.pushGetConversationsRemoved(data);
        const conversations = data.getLineConversations(this.filename, 15);
        assert.deepEqual(["- -> removed"], conversations.map(c => c.operation + ' -> ' + c.comments[0].id));
    }

    @test
    testGetConversations_02(): void {
        const data = this.createGetConversationsData();
        this.pushGetConversationsAdded(data);
        const conversations = data.getLineConversations(this.filename, 15);
        assert.deepEqual(["+ -> added"], conversations.map(c => c.operation + ' -> ' + c.comments[0].id));
    }

    @test
    testGetConversations_03(): void {
        const data = this.createGetConversationsData();
        this.pushGetConversationsRemoved(data);
        this.pushGetConversationsAdded(data);
        const conversations = data.getLineConversations(this.filename, 15);
        assert.deepEqual(["- -> removed", "+ -> added"], conversations.map(c => c.operation + ' -> ' + c.comments[0].id));
    }

    @test
    testGetConversations_04(): void {
        const data = this.createGetConversationsData();
        this.pushGetConversationsAdded(data);
        this.pushGetConversationsRemoved(data);
        const conversations = data.getLineConversations(this.filename, 15);
        assert.deepEqual(["- -> removed", "+ -> added"], conversations.map(c => c.operation + ' -> ' + c.comments[0].id));
    }

    @test
    testGetConversations_05(): void {
        const data = this.createGetConversationsData();
        this.pushGetConversationsUnchanged(data);
        const conversations = data.getLineConversations(this.filename, 14);
        assert.deepEqual(["  -> unchanged"], conversations.map(c => c.operation + ' -> ' + c.comments[0].id));
    }

    @test
    // https://github.com/TypeFox/gitpod/issues/284
    testIssue284(): void {
        const data = new GitHubData();
        data.pushFile({
            filename: this.filename,
            patch: `@@ -1,8 +1,7 @@
 const x = 1;
 
 
-const y = x + 1;
-
+const z = x + y + 1;
 
 
-const z = x + y + 1;
+const y = x + 1;`});
        data.pushComment(<PullRequestReviewComment>{
            id: 'unchanged',
            path: this.filename,
            position: 8,
            diffHunk: `@@ -1,8 +1,7 @@
 const x = 1;
 
 
-const y = x + 1;
-
+const z = x + y + 1;
 
 `});
        this.asserConversations([{
            operation: ' ',
            id: 'unchanged',
            originalLineNumber: 7
        }], data.getLineConversations(this.filename, 6), 'modified');

        this.asserConversations([], data.getLineConversations(this.filename, 7), 'original');
    }

    protected createIssue420Data(): GitHubData {
        const data = new GitHubData();
        data.pushFile({
            filename: "foo.js",
            previous_filename: "test-js.js",
            patch: `@@ -5,4 +5,4 @@ const y = x + 1;
 
 
 
-const z = x + y + 1;
\\ No newline at end of file
+const a = x + y + 1;
\\ No newline at end of file`
        });
        return data;
    }

    @test
    // https://github.com/TypeFox/gitpod/issues/420
    testIssue420_original_hunk(): void {
        this.assertHunks(`
5 -> 1:  
6 -> 2:  
7 -> 3:  
8 -> 4: -const z = x + y + 1;
`, 1, 10, 'original', this.createIssue420Data(), 'test-js.js');
    }

    @test
    // https://github.com/TypeFox/gitpod/issues/420
    testIssue420_modified_hunk(): void {
        this.assertHunks(`
5 -> 1:  
6 -> 2:  
7 -> 3:  
8 -> 6: +const a = x + y + 1;
`, 1, 10, 'modified', this.createIssue420Data(), 'foo.js');
    }

    @test
    // https://github.com/TypeFox/gitpod/issues/420
    testIssue420_added(): void {
        const data = this.createIssue420Data();
        data.pushComment(<PullRequestReviewComment>{
            id: "added",
            path: "foo.js",
            position: 6,
            diffHunk: `@@ -5,4 +5,4 @@ const y = x + 1;
 
 
 
-const z = x + y + 1;
\ No newline at end of file
+const a = x + y + 1;`});
        this.asserConversations([], data.getLineConversations("test-js.js", 8), 'original');

        this.asserConversations([{
            operation: '+',
            id: 'added',
            originalLineNumber: undefined
        }], data.getLineConversations("foo.js", 8), 'modified');
    }

    @test
    // https://github.com/TypeFox/gitpod/issues/420
    testIssue420_removed_from_github(): void {
        const data = this.createIssue420Data();
        data.pushComment(<PullRequestReviewComment>{
            id: "removed",
            path: "foo.js",
            position: 4,
            diffHunk: `@@ -5,4 +5,4 @@ const y = x + 1;
 
 
 
-const z = x + y + 1;`});
        this.asserConversations([], data.getLineConversations("test-js.js", 8), 'original');

        this.asserConversations([{
            operation: '-',
            id: 'removed',
            originalLineNumber: undefined
        }], data.getLineConversations("foo.js", 8), 'modified');
    }

    @test
    // https://github.com/TypeFox/gitpod/issues/420
    testIssue420_removed_from_gitpod(): void {
        const data = this.createIssue420Data();
        data.pushComment(<PullRequestReviewComment>{
            id: "removed",
            path: "test-js.js",
            position: 4,
            diffHunk: `@@ -5,4 +5,4 @@ const y = x + 1;
 
 
 
-const z = x + y + 1;`});
        this.asserConversations([], data.getLineConversations("tsts-js.js", 8), 'original');

        this.asserConversations([{
            operation: '-',
            id: 'removed',
            originalLineNumber: undefined
        }], data.getLineConversations("foo.js", 8), 'modified');
    }

    @test
    // https://github.com/TypeFox/gitpod/issues/420
    testIssue420_unchanged_original(): void {
        const data = this.createIssue420Data();
        data.pushComment(<PullRequestReviewComment>{
            id: "unchanged",
            path: "test-js.js",
            position: 1,
            diffHunk: `@@ -5,4 +5,4 @@ const y = x + 1;
 `});
        this.asserConversations([], data.getLineConversations("test-js.js", 5), 'original');

        this.asserConversations([{
            operation: ' ',
            id: 'unchanged',
            originalLineNumber: 5
        }], data.getLineConversations("foo.js", 5), 'modified');
    }

    @test
    // https://github.com/TypeFox/gitpod/issues/420
    testIssue420_unchanged_modified(): void {
        const data = this.createIssue420Data();
        data.pushComment(<PullRequestReviewComment>{
            id: "unchanged",
            path: "foo.js",
            position: 1,
            diffHunk: `@@ -5,4 +5,4 @@ const y = x + 1;
 `});
        this.asserConversations([], data.getLineConversations("test-js.js", 5), 'original');

        this.asserConversations([{
            operation: ' ',
            id: 'unchanged',
            originalLineNumber: 5
        }], data.getLineConversations("foo.js", 5), 'modified');
    }

    protected createIssue420LessLinesData(): GitHubData {
        const data = new GitHubData();
        data.pushFile({
            filename: "foo.js",
            previous_filename: "test-js.js",
            patch: `@@ -1,8 +1,7 @@
 const x = 1;
 
 
-const y = x + 1;
-
+const z = x + y + 1;
 
 
-const z = x + y + 1;
+const y = x + 1;`});
        return data;
    }

    @test
    testIssue420_removed_less_lines(): void {
        const data = this.createIssue420LessLinesData();
        data.pushComment(<PullRequestReviewComment>{
            id: 'removed',
            path: "foo.js",
            position: 9,
            diffHunk: `@@ -1,8 +1,7 @@
 const x = 1;
 
 
-const y = x + 1;
-
+const z = x + y + 1;
 
 
-const z = x + y + 1;`});
        this.asserConversations([{
            operation: '-',
            id: 'removed',
            originalLineNumber: undefined
        }], data.getLineConversations("foo.js", 8), 'original');
    }

    @test
    testIssue464_changed_original_position(): void {
        const data = this.createIssue420LessLinesData();
        assert.equal(9, data.getDiffPosition('original', 'test-js.js', 8));
    }

    @test
    testIssue464_changed_modified_position(): void {
        const data = this.createIssue420LessLinesData();
        assert.equal(10, data.getDiffPosition('modified', 'foo.js', 7));
    }

    @test
    testIssue464_unchanged_original_position(): void {
        const data = this.createIssue420LessLinesData();
        assert.equal(8, data.getDiffPosition('original', 'test-js.js', 7));
    }

    @test
    testIssue464_unchanged_modified_position(): void {
        const data = this.createIssue420LessLinesData();
        assert.equal(8, data.getDiffPosition('modified', 'foo.js', 6));
    }

}
