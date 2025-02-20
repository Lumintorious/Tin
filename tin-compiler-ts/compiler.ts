import { Lexer, Token } from "./Lexer";
import { Block, Parser, Import } from "./Parser";
import fs from "node:fs";
import { escape } from "node:querystring";
import { translateFile } from "./translator.js";
import { TypeChecker } from "./TypeChecker";
import { exec } from "node:child_process";
import files from "node:fs/promises";

Error.stackTraceLimit = 30;

function tokenTablePrint(tokens: Token[]) {
   let str = "";
   for (let i = 0; i <= tokens.length; i++) {
      const t = tokens[i];
      if (t === undefined) {
         str += "--undefined--";
      } else {
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

function lexerPhase(data: string) {
   const lexer = new Lexer(data);

   return lexer.lexAllTokens();
}

function parserPhase(tokens: Token[]) {
   const parser = new Parser(tokens);
   const ast = parser.parse();
   return ast;
}

function objectToYAML(obj: object, omitFields: string[] = [], indentLevel = 0) {
   const yaml: String[] = [];

   function processObject(obj: { [_: string]: any }, indentLevel: number) {
      const indent = "  ".repeat(indentLevel);

      for (const key in obj) {
         if (omitFields.includes(key)) continue; // Skip omitted fields

         const value: any = obj[key];

         if (
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value)
         ) {
            // If the value is a nested object, process it recursively

            yaml.push(`${indent}${key}:`);
            processObject(value, indentLevel + 1);
         } else if (Array.isArray(value)) {
            // Handle arrays and ensure dashes are on the same line as the first key of the object
            yaml.push(`${indent}${key}:`);
            value.forEach((item) => {
               if (typeof item === "object" && item !== null) {
                  const firstKey = Object.keys(item)[0];
                  const firstValue = item[firstKey];
                  const formattedFirstValue =
                     typeof firstValue === "string"
                        ? `${firstValue}`
                        : firstValue;

                  // Start the object with the dash and the first key-value pair
                  yaml.push(
                     `${"  ".repeat(
                        indentLevel + 1
                     )}- ${firstKey}: ${formattedFirstValue}`
                  );

                  // Process the remaining key-value pairs of the object, if any
                  const remainingKeys = Object.keys(item).slice(1);
                  remainingKeys.forEach((k) => {
                     const v = item[k];

                     if (v !== undefined) {
                        if (typeof v === "object" && v !== null) {
                           yaml.push(`${"  ".repeat(indentLevel + 2)}${k}:`);
                           processObject(v, indentLevel + 3); // Recursively process nested objects
                        } else {
                           const formattedValue =
                              typeof v === "string" ? `${v}` : v;
                           yaml.push(
                              `${"  ".repeat(
                                 indentLevel + 2
                              )}${k}: ${formattedValue}`
                           );
                        }
                     }
                  });
               } else {
                  // For simple values in arrays, keep the dash on the same line
                  if (item !== undefined) {
                     const formattedItem =
                        typeof item === "string" ? `${item}` : item;
                     yaml.push(
                        `${"  ".repeat(indentLevel + 1)}- ${formattedItem}`
                     );
                  }
               }
            });
         } else {
            // Handle primitive values
            const formattedValue =
               typeof value === "string" ? `${value}` : value;
            yaml.push(`${indent}${key}: ${formattedValue}`);
         }
      }
   }

   processObject(obj, indentLevel);
   return yaml.join("\n");
}

const outFolder = "tin-out/";
if (!fs.existsSync(outFolder)) {
   files.mkdir(outFolder);
}

function fullPath(path: string) {
   return process.cwd() + "./" + path + ".tin";
}

async function getImports(
   ast: Block,
   importsCache: Map<String, CompileResult>
): Promise<Map<String, CompileResult>> {
   const imports = importsCache;
   for (let i = 0; i < ast.statements.length; i++) {
      const statement = ast.statements[i];
      if (statement instanceof Import) {
         const path = fullPath(statement.path);
         if (!imports.has(path)) {
            imports.set(
               path,
               await compile(
                  "./" + statement.path + ".tin",
                  false,
                  importsCache
               )
            );
         }
      } else {
         break;
      }
   }
   return imports;
}

type CompileResult = {
   inputText: string;
   tokens: Token[];
   ast: Block;
   typeChecker: TypeChecker;
   outputText: string;
};

async function compile(
   inputFile: string,
   run: boolean = false,
   importsCache: Map<String, CompileResult>
): Promise<CompileResult> {
   // READ
   const inputContents: string = await files.readFile(
      "./src/" + inputFile,
      "utf-8"
   );

   // LEXER
   const tokens = lexerPhase(inputContents);
   await files.writeFile(
      outFolder + inputFile + ".tok.txt",
      tokenTablePrint(tokens)
   );

   // PARSER
   let ast = parserPhase(tokens);
   await files.writeFile(
      outFolder + inputFile + ".ast.yaml",
      objectToYAML(ast, ["position", "fromTo", "isTypeLevel", "position"])
   );
   // IMPORTS
   const imports = await getImports(ast, importsCache);

   // TYPE CHECKING
   const scopes = [] as any;
   const importedScopes = imports.forEach((i, k) =>
      scopes.push(i.typeChecker.fileScope.innerScopeOf(i.ast))
   );
   const typeChecker = TypeChecker.fromAST(ast, scopes);
   typeChecker.typeCheck(ast, typeChecker.fileScope);
   typeChecker.errors.throwAll();

   // TRANSLATION
   const translatedString = translateFile(ast, typeChecker.fileScope);
   await files.writeFile(outFolder + inputFile + ".out.js", translatedString);

   console.log("Compiled " + inputFile);
   // RUNNING
   if (run) {
      console.log("==================== Compiled! ====================");
      exec(
         'cd "' + outFolder + '"' + " && node " + inputFile + ".out.js",
         (_, out, err) => {
            console.log(out);
            console.log(err);
         }
      );
   } else {
   }
   return {
      inputText: inputContents,
      tokens,
      ast,
      typeChecker,
      outputText: translatedString,
   };
}

void compile(inputFile, true, new Map());
