// Licensed under the MIT license.

//import { EventEmitter } from "events";
import * as vscode from "vscode";

class LeetCodeDebugger {
    public async startDebugging(filePath: string): Promise<void> {
        vscode.window.showInformationMessage(`Debugging! ${filePath}`);
    }
}

export const leetCodeDebugger: LeetCodeDebugger = new LeetCodeDebugger();
