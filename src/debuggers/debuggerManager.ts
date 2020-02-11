// Licensed under the MIT license.

import { Debugger } from "./debugger"
import { CppDebugger } from "./cppDebugger"

export interface IDebuggerConstructor {
    new(): Debugger
}

export function getDebugger(language: string): IDebuggerConstructor | undefined {
    switch (language) {
        case "cpp": return CppDebugger;
    }
    // unsupported yet!
    return undefined;
}
