// Licensed under the MIT license.

import * as vscode from "vscode"

export abstract class Debugger {
    public constructor(protected problemId: string, protected codeTemplate: string) { };
    // return [file path] to start debugging, [undefined] to give up debugging
    public abstract async init(solutionEditor: vscode.TextEditor): Promise<string | undefined>;
    // dispose after debugging
    public abstract async dispose(solutionEditor: vscode.TextEditor): Promise<void>;
}
