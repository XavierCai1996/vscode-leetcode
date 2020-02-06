// Licensed under the MIT license.

import * as vscode from "vscode";
import * as path from "path";
import { IQuickItemEx, langExt } from "./shared";
import { fetchProblemLanguage } from "./commands/show";
import { leetCodeExecutor } from "./leetCodeExecutor";
import { IDebuggerConstructor, getDebugger } from "./debuggers/debuggerManager";

class LeetCodeDebugger {
    public async startDebugging(solutionFilePath: string): Promise<void> {
        const language: string | undefined = await fetchProblemLanguage();
        if (!language) {
            return;
        }

        //TODO: need a more robust way to get problem id
        const ext: string | undefined = langExt.get(language);
        if (!ext) {
            return;
        }
        const baseName: string = path.basename(solutionFilePath);
        const reg: RegExp = new RegExp("(\\d+)\\." + ext);
        const matches = reg.exec(baseName)
        if (!matches || matches[0] !== baseName) {
            return;
        }
        const problemId: string = matches[1];

        const codeTemplate: string = await leetCodeExecutor.getCodeTemplate(problemId, language, false);
        const ctor: IDebuggerConstructor | undefined = getDebugger(language);
        if (!ctor) {
            vscode.window.showInformationMessage(`Unsupport language: ${language}`);
            return;
        }

        const debuggerInstance = new ctor(solutionFilePath, codeTemplate);
        try {
            debuggerInstance.init();
            vscode.debug.onDidTerminateDebugSession(() => { debuggerInstance.dispose(); });
            await this.launch();
        }
        catch {
            vscode.window.showInformationMessage('Failed to start debugging');
            debuggerInstance.dispose();
        }
    }

    private async launch(): Promise<void> {
        let textEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
        if (!textEditor) {
            return;
        }

        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("launch", textEditor.document.uri);
        const folder: vscode.WorkspaceFolder | undefined = vscode.workspace.getWorkspaceFolder(textEditor.document.uri);
        const values: [{}] | undefined = config.get<[{}]>("configurations");
        if (!folder || !values) {
            return;
        }

        const picks: Array<IQuickItemEx<string>> = [];
        for (const index in values) {
            const name: string = values[index]["name"]
            const request: string = values[index]["request"]
            if (name && request) {
                picks.push(
                    {
                        label: name,
                        detail: request,
                        value: index,
                    }
                );
            }
        }
        if (picks.length <= 0) {
            return;
        }

        let launchIndex: string = picks[0].value;
        if (picks.length > 1) { // pick one
            const choice: IQuickItemEx<string> | undefined = await vscode.window.showQuickPick(picks);
            if (!choice) {
                return;
            }
            launchIndex = choice.value;
        }

        // error!
        if (!(launchIndex in values)) {
            return;
        }

        await vscode.debug.startDebugging(folder, values[launchIndex]["name"]);
    }
}

export const leetCodeDebugger: LeetCodeDebugger = new LeetCodeDebugger();
