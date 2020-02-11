// Licensed under the MIT license.

import * as vscode from "vscode";
import * as fse from "fs-extra";
import * as path from "path";
import { Debugger } from "./debugger";

export class CppDebugger extends Debugger {
    private solutionFilePath: string;
    private definitionFilePath: string;
    private mainFilePath: string;

    public async init(solutionEditor: vscode.TextEditor, codeTemplate: string): Promise<string | undefined> {
        if (!solutionEditor || solutionEditor.document.isClosed || !codeTemplate) {
            return;
        }

        this.solutionFilePath = solutionEditor.document.uri.fsPath;
        const folder: string = path.dirname(this.solutionFilePath);
        this.definitionFilePath = path.join(folder, "definition.h");
        this.mainFilePath = path.join(folder, "leetcode-cpp-debug.cpp");

        // insert include code to solution file
        const insertContent: string = "#include \"" + path.basename(this.definitionFilePath) + "\"\n";
        const editResult: boolean = await solutionEditor.edit((editor: vscode.TextEditorEdit) => editor.insert(new vscode.Position(0, 0), insertContent));
        if (!editResult) {
            return;
        }

        await this.genDefinitionFile();
        await this.genMainFile();

        return this.mainFilePath;
    }

    public async dispose(solutionEditor: vscode.TextEditor): Promise<void> {
        // remove inserted include code
        if (solutionEditor.document.isClosed) {
            return;
        }
        const result: boolean = await solutionEditor.edit((editor: vscode.TextEditorEdit) => { editor.delete(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(1, 0))); });
        vscode.window.showInformationMessage(`${result}`);
    }

    private async genDefinitionFile(): Promise<void> {
        if (!this.definitionFilePath) {
            return;
        }
        if (!await fse.pathExists(this.definitionFilePath)) {
            const definition: string = " \n \
            #ifndef LEETCODE_DEFINITION \n \
            #define LEETCODE_DEFINITION \n \
            #include <bits/stdc++.h> \n \
            using namespace std; \n \
            struct ListNode { \n \
                int val; \n \
                ListNode *next; \n \
                ListNode(int x) : val(x), next(NULL) {} \n \
            }; \n \
            struct TreeNode { \n \
                int val; \n \
                TreeNode *left; \n \
                TreeNode *right; \n \
                TreeNode(int x) : val(x), left(NULL), right(NULL) {} \n \
            }; \n \
            #endif \n \
            "
            await fse.createFile(this.definitionFilePath);
            await fse.writeFile(this.definitionFilePath, definition);
        }
    }

    private async genMainFile(): Promise<void> {
        if (!this.mainFilePath) {
            return;
        }

        if (!await fse.pathExists(this.mainFilePath)) {
            await fse.createFile(this.mainFilePath);
        }
        const fp: number = await fse.open(this.mainFilePath, "w");

        function output(data: string): void {
            fse.writeSync(fp, data);
        }

        output("#include \"" + path.basename(this.definitionFilePath) + "\"\n");
        output("#include \"" + path.basename(this.solutionFilePath) + "\"\n");
        output(" \n \
        int main() { \n \
            Solution s; \n \
            vector<int> v {1, 2}; \n \
            s.twoSum(v, 3); \n \
            return 0; \n \
        } \n \
        ");

        await fse.fsync(fp);
        await fse.close(fp);
    }
}
