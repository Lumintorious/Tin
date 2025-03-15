import { Lexer, Token } from "./Lexer";
import { Block, Parser, Import } from "./Parser";
import fs from "node:fs";
import { escape } from "node:querystring";
import { translateFile } from "./translator.js";
import { TypeChecker } from "./TypeChecker";
import { exec } from "node:child_process";
import files from "node:fs/promises";
import path from "node:path";
import { TypePhaseContext } from "./Scope";

Error.stackTraceLimit = 40;
const SRC_PATH = path.resolve(process.cwd(), "src");
const OUT_PATH = path.resolve(process.cwd(), "tin-out");

function fromSrcToOut(pathStr: string) {
   if (pathStr.startsWith(SRC_PATH)) {
      pathStr = pathStr.substring(SRC_PATH.length + 1);
      return path.resolve(OUT_PATH, pathStr);
   }
   throw new Error("Src Path wasn't in /src");
}

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

            if (!omitFields.includes(key)) {
               // Skip omitted fields
               yaml.push(`${indent}${key}:`);
               processObject(value, indentLevel + 1);
            }
         } else if (Array.isArray(value)) {
            // Handle arrays and ensure dashes are on the same line as the first key of the object
            if (omitFields.includes(key)) continue; // Skip omitted fields
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

function fullPath(pathStr: string) {
   return path.resolve(process.cwd(), "src", pathStr);
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
         statement.path = path;
         if (!imports.has(path)) {
            imports.set(
               path,
               await compile(statement.path + ".tin", false, importsCache)
            );
         }
      } else {
         break;
      }
   }
   return imports;
}

function ensureParentDirs(filePath: string) {
   const dir = path.dirname(filePath);
   fs.mkdirSync(dir, { recursive: true });
}

type CompileResult = {
   inputText: string;
   tokens: Token[];
   ast: Block;
   typePhaseContext: TypePhaseContext;
   outputText: string;
};

async function compile(
   inputFile: string,
   run: boolean = false,
   importsCache: Map<String, CompileResult>
): Promise<CompileResult> {
   try {
      // READ
      const inputContents: string = await files.readFile(inputFile, "utf-8");
      ensureParentDirs(fromSrcToOut(inputFile));

      // LEXER
      const tokens = lexerPhase(inputContents);
      await files.writeFile(
         fromSrcToOut(inputFile + ".tok.txt"),
         tokenTablePrint(tokens)
      );

      // PARSER
      let ast = parserPhase(tokens);
      await files.writeFile(
         fromSrcToOut(inputFile + ".ast.yaml"),
         objectToYAML(ast, ["position", "fromTo", "isTypeLevel", "position"])
      );

      // IMPORTS
      const imports = await getImports(ast, importsCache);

      // TYPE CHECKING
      const scopes = [] as any;
      imports.forEach((i, k) =>
         scopes.push(i.typePhaseContext.fileScope.innerScopeOf(i.ast))
      );
      const context = new TypePhaseContext(inputFile, ast, scopes);
      context.checker.typeCheck(ast, context.fileScope);
      context.errors.throwAll();

      // TRANSLATION
      const translatedString = translateFile(ast, context.fileScope);
      await files.writeFile(
         fromSrcToOut(inputFile + ".out.js"),
         translatedString
      );

      console.log("\x1b[32mCompiled " + inputFile + "\x1b[0m");
      // RUNNING
      if (run) {
         console.log(
            "========================= Output ============================"
         );
         exec(
            'cd "tin-out"' + " && node " + fromSrcToOut(inputFile + ".out.js"),
            (_, out, err) => {
               console.log(out);
               if (err) {
                  console.log(err);
               }
            }
         );
      } else {
      }
      return {
         inputText: inputContents,
         tokens,
         ast,
         typePhaseContext: context,
         outputText: translatedString,
      };
   } catch (e) {
      console.error(e);
      process.exit(0);
   }
}

const allPath = path.resolve(process.cwd(), "src", inputFile);
void compile(allPath, true, new Map());
