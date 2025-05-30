import { exec } from "node:child_process";
import { CompilerItem, OutputTranslator } from "./compiler";
import { Scope } from "./Scope";
import { AstNode, Block, Call, Identifier, Import, Literal } from "./Parser";

export class JavaTranslator implements OutputTranslator {
   extension = "java";
   isStdLib: boolean = false;
   fileName: string;
   constructor(fileName: string, isStdLib: boolean = false) {
      this.isStdLib = isStdLib;
      this.fileName = fileName;
   }

   getOutputFileName(inputFileName: string): string {
      const parts = inputFileName.split("\\");
      const lastPart = parts[parts.length - 1];
      const firstChar = lastPart.at(0)?.toUpperCase();
      parts[parts.length - 1] = firstChar + lastPart.substring(1);
      inputFileName = parts.join("/");
      return inputFileName + "" + this.extension;
   }

   run(path: string, isTest?: boolean): void {
      console.log("Running " + path);
      exec(
         `cd "tin-out-java${isTest ? "-tests" : ""}"` +
            " && java --enable-preview " +
            path,
         (_, out, err) => {
            console.log(out);
            if (err) {
               console.log(err);
            }
         }
      );
   }

   translate(term: CompilerItem, scope: Scope, options: any): string {
      if (term === undefined) {
         return "null";
      }

      if (term instanceof AstNode) {
         return this.translateNode(term, scope, options);
      }

      return `(? ${term} ?)`;
   }

   translateNode(term: AstNode, scope: Scope, options: any = {}): string {
      if (term instanceof Identifier) {
         return term.value;
      } else if (term instanceof Literal) {
         if (term.type === "String") {
            return `"${term.value}"`;
         }
         return String(term.value);
      } else if (term instanceof Block) {
         let result =
            term.statements
               .map((s) => this.translateNode(s, scope.innerScopeOf(term), {}))
               .join(";\n") + ";";

         if (options.isTopLevel) {
            result = `void main() {\n${result}\n}`;
         }
         return result;
      } else if (term instanceof Import) {
         const parts = term.path.split("tin-out");
         return `System.out.println("${parts[1].replaceAll("\\", "/")})")`;
      } else if (term instanceof Call) {
         return `${this.translateNode(term.callee, scope)}(${term.args.map(
            (p) => this.translateNode(p[1], scope)
         )})`;
      }

      return `(? ${term.tag} ?)`;
   }
}
