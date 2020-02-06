// Licensed under the MIT license.

import * as vscode from "vscode";
import { IQuickItemEx } from "./shared";

class LeetCodeDebugger {
    public async startDebugging(solutionFilePath: string): Promise<void> {
        //TODO: create files for debugging
        await this.launch();
    }

    private async launch(): Promise<void> {
        let textEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
        if (!textEditor) {
            return;
        }

        const config = vscode.workspace.getConfiguration("launch", textEditor.document.uri);
        const folder = vscode.workspace.getWorkspaceFolder(textEditor.document.uri);
        const values = config.get<[{}]>("configurations");
        if (!folder || !values) {
            return;
        }

        const picks: Array<IQuickItemEx<string>> = [];
        for (const index in values) {
            const name = values[index]["name"]
            const request = values[index]["request"]
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
