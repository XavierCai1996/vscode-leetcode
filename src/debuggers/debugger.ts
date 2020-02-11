// Licensed under the MIT license.

import * as vscode from "vscode"

export abstract class Debugger {
    // return [file path] to start debugging, [undefined] to give up debugging
    public abstract async init(solutionEditor: vscode.TextEditor, codeTemplate: string): Promise<string | undefined>;
    // dispose after debugging
    public abstract async dispose(solutionEditor: vscode.TextEditor): Promise<void>;
}
