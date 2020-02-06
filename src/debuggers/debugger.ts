// Licensed under the MIT license.

export abstract class Debugger {
    constructor(protected solutionFilePath: string, protected codeTemplate: string) { }
    public abstract async init(): Promise<string | undefined>;
    public abstract async dispose(): Promise<void>;
}
