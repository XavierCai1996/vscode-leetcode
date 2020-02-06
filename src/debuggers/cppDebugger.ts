// Licensed under the MIT license.

import * as vscode from "vscode"
import { Debugger } from "./debugger";

export class CppDebugger extends Debugger {
    init() {
        vscode.window.showInformationMessage(`Hello: ${this.solutionFilePath}`);
        vscode.window.showInformationMessage(`World: ${this.codeTemplate}`);
    }

    dispose() {
        vscode.window.showInformationMessage(`Clear!`);
    }
}
