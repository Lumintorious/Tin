"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Lexer_1 = require("./Lexer");
const Parser_1 = require("./Parser");
const node_fs_1 = __importDefault(require("node:fs"));
const translator_js_1 = require("./translator.js");
const TypeChecker_1 = require("./TypeChecker");
const node_child_process_1 = require("node:child_process");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
Error.stackTraceLimit = 30;
function tokenTablePrint(tokens) {
    let str = "";
    for (let i = 0; i <= tokens.length; i++) {
        const t = tokens[i];
        if (t === undefined) {
            str += "--undefined--";
        }
        else {
            str +=
                t.tag.padEnd(12, " ") +
                    " | " +
                    String(t.value || "")
                        .replace("\n", "")
                        .padEnd(12, " ") +
                    " | " +
                    String(t.position.start.line).padStart(3, " ") +
                    ", " +
                    String(t.position.start.column).padEnd(5, " ") +
                    "\n";
        }
    }
    return str;
}
let inputFile = process.argv[2];
if (!inputFile.endsWith(".tin")) {
    inputFile = inputFile + ".tin";
}
function lexerPhase(data) {
    const lexer = new Lexer_1.Lexer(data);
    return lexer.lexAllTokens();
}
function parserPhase(tokens) {
    const parser = new Parser_1.Parser(tokens);
    const ast = parser.parse();
    return ast;
}
function objectToYAML(obj, omitFields = [], indentLevel = 0) {
    const yaml = [];
    function processObject(obj, indentLevel) {
        const indent = "  ".repeat(indentLevel);
        for (const key in obj) {
            if (omitFields.includes(key))
                continue; // Skip omitted fields
            const value = obj[key];
            if (typeof value === "object" &&
                value !== null &&
                !Array.isArray(value)) {
                // If the value is a nested object, process it recursively
                yaml.push(`${indent}${key}:`);
                processObject(value, indentLevel + 1);
            }
            else if (Array.isArray(value)) {
                // Handle arrays and ensure dashes are on the same line as the first key of the object
                yaml.push(`${indent}${key}:`);
                value.forEach((item) => {
                    if (typeof item === "object" && item !== null) {
                        const firstKey = Object.keys(item)[0];
                        const firstValue = item[firstKey];
                        const formattedFirstValue = typeof firstValue === "string"
                            ? `${firstValue}`
                            : firstValue;
                        // Start the object with the dash and the first key-value pair
                        yaml.push(`${"  ".repeat(indentLevel + 1)}- ${firstKey}: ${formattedFirstValue}`);
                        // Process the remaining key-value pairs of the object, if any
                        const remainingKeys = Object.keys(item).slice(1);
                        remainingKeys.forEach((k) => {
                            const v = item[k];
                            if (v !== undefined) {
                                if (typeof v === "object" && v !== null) {
                                    yaml.push(`${"  ".repeat(indentLevel + 2)}${k}:`);
                                    processObject(v, indentLevel + 3); // Recursively process nested objects
                                }
                                else {
                                    const formattedValue = typeof v === "string" ? `${v}` : v;
                                    yaml.push(`${"  ".repeat(indentLevel + 2)}${k}: ${formattedValue}`);
                                }
                            }
                        });
                    }
                    else {
                        // For simple values in arrays, keep the dash on the same line
                        if (item !== undefined) {
                            const formattedItem = typeof item === "string" ? `${item}` : item;
                            yaml.push(`${"  ".repeat(indentLevel + 1)}- ${formattedItem}`);
                        }
                    }
                });
            }
            else {
                // Handle primitive values
                const formattedValue = typeof value === "string" ? `${value}` : value;
                yaml.push(`${indent}${key}: ${formattedValue}`);
            }
        }
    }
    processObject(obj, indentLevel);
    return yaml.join("\n");
}
const outFolder = "tin-out/";
if (!node_fs_1.default.existsSync(outFolder)) {
    promises_1.default.mkdir(outFolder);
}
function fullPath(path) {
    return process.cwd() + "./" + path + ".tin";
}
function getImports(ast, importsCache) {
    return __awaiter(this, void 0, void 0, function* () {
        const imports = importsCache;
        for (let i = 0; i < ast.statements.length; i++) {
            const statement = ast.statements[i];
            if (statement instanceof Parser_1.Import) {
                const path = fullPath(statement.path);
                if (!imports.has(path)) {
                    imports.set(path, yield compile("./" + statement.path + ".tin", false, importsCache));
                }
            }
            else {
                break;
            }
        }
        return imports;
    });
}
function ensureParentDirs(filePath) {
    const dir = node_path_1.default.dirname(filePath);
    node_fs_1.default.mkdirSync(dir, { recursive: true });
}
function compile(inputFile_1) {
    return __awaiter(this, arguments, void 0, function* (inputFile, run = false, importsCache) {
        // READ
        const inputContents = yield promises_1.default.readFile("./src/" + inputFile, "utf-8");
        ensureParentDirs(outFolder + inputFile);
        // LEXER
        const tokens = lexerPhase(inputContents);
        yield promises_1.default.writeFile(outFolder + inputFile + ".tok.txt", tokenTablePrint(tokens));
        // PARSER
        let ast = parserPhase(tokens);
        yield promises_1.default.writeFile(outFolder + inputFile + ".ast.yaml", objectToYAML(ast, ["position", "fromTo", "isTypeLevel", "position"]));
        // IMPORTS
        const imports = yield getImports(ast, importsCache);
        // TYPE CHECKING
        const scopes = [];
        const importedScopes = imports.forEach((i, k) => scopes.push(i.typeChecker.fileScope.innerScopeOf(i.ast)));
        const typeChecker = TypeChecker_1.TypeChecker.fromAST(ast, scopes);
        typeChecker.typeCheck(ast, typeChecker.fileScope);
        typeChecker.errors.throwAll();
        // TRANSLATION
        const translatedString = (0, translator_js_1.translateFile)(ast, typeChecker.fileScope);
        yield promises_1.default.writeFile(outFolder + inputFile + ".out.js", translatedString);
        console.log("Compiled " + inputFile);
        // RUNNING
        if (run) {
            console.log("==================== Compiled! ====================");
            (0, node_child_process_1.exec)('cd "' + outFolder + '"' + " && node " + inputFile + ".out.js", (_, out, err) => {
                console.log(out);
                console.log(err);
            });
        }
        else {
        }
        return {
            inputText: inputContents,
            tokens,
            ast,
            typeChecker,
            outputText: translatedString,
        };
    });
}
void compile(inputFile, true, new Map());
