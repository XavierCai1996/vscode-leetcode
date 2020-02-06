// Licensed under the MIT license.

export abstract class Debugger {
    constructor(protected solutionFilePath: string, protected codeTemplate: string) { }
    abstract init(): void;
    abstract dispose(): void;
}
