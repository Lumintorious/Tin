/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import { Hover, languages } from "vscode";
export function activate(context) {
    console.log("Congratulations, your extension 'tin-syntax-highlighting' is now active!");
    languages.registerHoverProvider("tin", {
        provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position);
            const word = document.getText(range);
            return new Hover(`This is a hover for ${word}`);
        },
    });
}
export function deactivate() { }
//# sourceMappingURL=extension.js.map