// Licensed under the MIT license.

import * as vscode from "vscode";
import { leetCodeDebugger } from "../leetCodeDebugger";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";
import { getActiveFilePath } from "../utils/workspaceUtils";

export async function debugSolution(uri?: vscode.Uri): Promise<void> {
    const filePath: string | undefined = await getActiveFilePath(uri);
    if (!filePath) {
        return;
    }

    try {
        await leetCodeDebugger.startDebugging(filePath);
    } catch (error) {
        await promptForOpenOutputChannel("Failed to start debugging", DialogType.error);
        return;
    }
}
