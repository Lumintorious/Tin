import { Lexer, Token } from "./Lexer";
import { Block, Parser, Import, AstNode } from "./Parser";
import fs from "node:fs";
import { JavascriptTranslator } from "./JavascriptTranslator";
import files from "node:fs/promises";
import path from "node:path";
import { Scope, TypePhaseContext } from "./Scope";
import { Type, ParamType } from "./Types";
import { GoTranslator } from "./GoTranslator";

export type CompilerItem = AstNode | Type | ParamType | undefined;

const SETTINGS = JSON.parse(fs.readFileSync("./tin.settings.json", "utf-8"));
console.log(SETTINGS);

export interface OutputTranslator {
   extension: string;
   run(path: string): void;
   translate(term: CompilerItem, scope: Scope, options: any): string;
}

Error.stackTraceLimit = 15;
const isTesting = process.argv.includes("--test");
const isCompilingToGo = process.argv.includes("--targetLanguage:go");
const SRC_PATH = path.resolve(process.cwd(), isTesting ? "tests" : "src");
const COMPILER_PATH = path.resolve(process.cwd(), "tin-compiler-ts");
const OUT_PATH = path.resolve(
   process.cwd(),
   isTesting ? "tin-out-tests" : "tin-out"
);
if (!process.argv.includes("--verbose")) {
   const log = console.log;
   console.log = (message) => {
      if (!String(message).startsWith("#")) {
         log(message);
      }
   };
} else {
   const log = console.log;
   console.log = (message) => {
      if (String(message).startsWith("#")) {
         log(message.substring(1).trim());
      } else {
         log(message);
      }
   };
}

function fromSrcToOut(pathStr: string) {
   if (pathStr.startsWith(SRC_PATH)) {
      pathStr = pathStr.substring(SRC_PATH.length + 1);
      return path.resolve(OUT_PATH, pathStr);
   } else if (pathStr.startsWith(COMPILER_PATH)) {
      pathStr = pathStr.substring(COMPILER_PATH.length + 1);
      return path.resolve(OUT_PATH, pathStr);
   }
   throw new Error(
      "Src Path wasn't in the correct directory, was in " + pathStr
   );
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
   return path.resolve(process.cwd(), isTesting ? "tests" : "src", pathStr);
}

async function getImports(
   ast: Block,
   importsCache: Map<String, CompileResult> = new Map()
): Promise<Map<String, CompileResult>> {
   const imports = importsCache;
   for (let i = 0; i < ast.statements.length; i++) {
      const statement = ast.statements[i];
      if (statement instanceof Import) {
         const path = fullPath(statement.path);
         const rawPath = statement.path;
         statement.path = path;
         if (!imports.has(path) && !imports.has(rawPath)) {
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
      const inputContents: string = fs.readFileSync(inputFile, "utf-8");
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

      if (!inputFile.endsWith("stdlib.tin")) {
         ast.statements = [new Import("stdlib"), ...ast.statements];
      }

      // IMPORTS
      const imports = await getImports(ast, importsCache);

      // TYPE CHECKING
      const scopes = [] as any;
      imports.forEach((i, k) =>
         scopes.push(i.typePhaseContext.fileScope.innerScopeOf(i.ast))
      );
      const context = new TypePhaseContext(inputFile, ast, scopes);
      const uncheckedSymbols = context.fileScope.checkNoUncheckedTypesLeft();
      for (const uncheckedSymbol of uncheckedSymbols) {
         console.error(uncheckedSymbol[1].name + " @ " + uncheckedSymbol[0]);
      }
      context.checker.typeCheck(ast, context.fileScope);
      const errors = context.errors.getErrors();
      if (errors) {
         if (isTesting) {
            return Promise.reject(new Error(errors));
         } else {
            console.error("\x1b[31m" + errors + "\x1b[0m");
            process.exit(-1);
         }
      }

      const OUTPUT_TRANSLATOR: OutputTranslator = isCompilingToGo
         ? new GoTranslator()
         : new JavascriptTranslator(importsCache.size === 0);

      // TRANSLATION
      const translatedString = OUTPUT_TRANSLATOR.translate(
         ast,
         context.fileScope,
         { isTopLevel: true }
      );
      await files.writeFile(
         fromSrcToOut(inputFile + ".out." + OUTPUT_TRANSLATOR.extension),
         translatedString
      );

      console.log("\x1b[32mCompiled " + inputFile + "\x1b[0m");
      // RUNNING
      if (run) {
         console.log(
            "\x1b[37m=========================== Output ==============================\x1b[0m"
         );
         OUTPUT_TRANSLATOR.run(
            fromSrcToOut(inputFile + ".out." + OUTPUT_TRANSLATOR.extension)
         );
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

async function run() {
   const allPath = path.resolve(
      process.cwd(),
      isTesting ? "tests" : "src",
      inputFile
   );
   // console.clear();
   // exec("cls");
   if (isTesting) {
      const folderPath = path.resolve(process.cwd(), "tests");
      const files = fs.readdirSync(folderPath, {
         recursive: true,
         withFileTypes: true,
      });
      let errorsAmount = 0;
      async function doTest(pathStr: string, file: fs.Dirent) {
         if (file.name.endsWith(".tin")) {
            const fileNameShort = file.name;
            const fileName = path.resolve(pathStr, fileNameShort);
            const log = console.log;
            const nameToLog = fileName.substring(folderPath.length + 1);
            console.log = () => {};
            try {
               process.stdout.write("\x1b[34m[ ] " + nameToLog + "\x1b[0m");
               console.log = () => {};
               await compile(fileName, false, new Map());
               console.log = log;
               process.stdout.write("\r\x1b[K");
               process.stdout.write(`\x1b[32m[✓] ${nameToLog}\x1b[0m\n`);
            } catch (e) {
               if (e instanceof Error) {
                  errorsAmount++;
                  console.log = log;
                  process.stdout.write("\r\x1b[K");
                  process.stdout.write(
                     `\x1b[31m[x] ${nameToLog}\n    ${e.message.replaceAll(
                        "\n",
                        "\n    "
                     )}\x1b[0m\n`
                  );
               }
            }
         } else if (file.isDirectory()) {
            const name = path.resolve(pathStr, file.name);
            const files = fs.readdirSync(name, {
               recursive: true,
               withFileTypes: true,
            });
            files.sort((a, b) => (a.isDirectory() ? 0 : 1));
            for (let file of files) {
               await doTest(name, file);
            }
         }
      }
      files.sort((a, b) => (b.isDirectory() ? -1 : 1));
      for (let file of files) {
         await doTest(folderPath, file);
      }
      if (errorsAmount) {
         process.stdout.write(
            `\n\x1b[41m====> Oh, there ${
               errorsAmount === 1 ? "is" : "are"
            } ${errorsAmount} ${
               errorsAmount === 1 ? "test failure" : "test failures"
            }.\x1b[0m`
         );
      } else {
         process.stdout.write(
            `\n\x1b[42m====> Great, all tests passed!\x1b[0m`
         );
      }
   } else {
      const stdlib = await compile(
         path.resolve(process.cwd(), "tin-compiler-ts", "stdlib.tin"),
         false,
         new Map()
      );
      void compile(allPath, true, new Map([["stdlib", stdlib]]));
   }
}

run();
