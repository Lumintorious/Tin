import { Lexer, Token } from "./Lexer";
import { Parser } from "./Parser";
import fs from "node:fs";
import { escape } from "node:querystring";
import { translateFile } from "./translator.js";
import { TypeChecker } from "./TypeChecker";
import { exec } from "node:child_process";

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

async function compile() {}

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

fs.readFile(inputFile, "utf8", (err: any, data: string) => {
   const tokens = lexerPhase(data);
   fs.writeFile(process.argv[2] + ".tok.txt", tokenTablePrint(tokens), () => {
      const ast = parserPhase(tokens);
      fs.writeFile(
         process.argv[2] + ".ast.yaml",
         objectToYAML(ast, ["position", "fromTo", "isTypeLevel"]),
         () => {
            const typeChecker = TypeChecker.fromAST(ast);
            try {
               typeChecker.typeCheck(ast, typeChecker.fileScope);
               const symbolSummary: { [_: string]: string } = {};
               typeChecker.fileScope.symbols.forEach((value, key) => {
                  symbolSummary[value.index ?? -1] =
                     key + " :: " + value.typeSymbol.toString();
               });
               typeChecker.fileScope.typeSymbols.forEach((value, key) => {
                  symbolSummary[value.index ?? -1] =
                     key + " :: " + value.toString();
               });
               fs.writeFile(
                  process.argv[2] + ".symbols.yaml",
                  objectToYAML(symbolSummary, ["fromTo"]),
                  () => {
                     // require("./../" + process.argv[2] + ".out.js")
                  }
               );
               typeChecker.errors.throwAll();
            } catch (e) {
               console.error(e);
            }
            const translatedStr = translateFile(ast, typeChecker.fileScope);
            fs.writeFile(process.argv[2] + ".out.js", translatedStr, () => {
               if (process.argv.includes("--run")) {
                  exec(
                     "node " + process.argv[2] + ".out.js",
                     (oops, out, err) => {
                        console.log(out ? out : err);
                     }
                  );
               } else {
                  console.log("Compiler exit.");
               }
            });
         }
      );
   });
});
