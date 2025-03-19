import { exec } from "node:child_process";
import { OutputTranslator, CompilerItem } from "./compiler";
import { Scope } from "./Scope";
import { RoundApply, Select, Term, RoundValueToValueLambda } from "./Parser";
import { RoundValueToValueLambdaType, NamedType } from "./Types";
import {
   Literal,
   Assignment,
   Block,
   Identifier,
   Import,
   TypeDef,
} from "./Parser";

export class GoTranslator implements OutputTranslator {
   extension = "go";
   run(path: string): void {
      exec('cd "tin-out"' + " && go run " + path, (_, out, err) => {
         console.log(out);
         if (err) {
            console.log(err);
         }
      });
   }

   identifierMap: { [_: string]: string } = {
      String: "string",
      Number: "float64",
      print: "fmt.Println",
      Nothing: "void",
   };

   translate(term: CompilerItem, scope: Scope, options: any = {}): string {
      if (term instanceof Literal) {
         if (term.type === "String") {
            return `"${term.value}"`;
         } else {
            return String(term.value);
         }
      } else if (term instanceof Identifier) {
         if (Object.keys(this.identifierMap).includes(term.value)) {
            return this.identifierMap[term.value];
         }
         return term.value.replaceAll("@", "__");
      } else if (term instanceof Assignment) {
         if (
            term.value instanceof Identifier &&
            term.value.value === "external"
         ) {
            return "";
         }
         if (
            term.value instanceof TypeDef ||
            term.value instanceof RoundValueToValueLambda
         ) {
            return this.translate(term.value, scope);
         }
         const keyword = term.isDeclaration ? "var " : "";
         const type = term.type ? " " + this.translate(term.type, scope) : "";
         const value = term.value
            ? " = " + this.translate(term.value, scope)
            : "";
         return `${keyword}${this.translate(term.lhs, scope)}${type}${value}`;
      } else if (term instanceof Block) {
         let pck = "";
         if (options.isTopLevel) {
            pck = 'package main; import "fmt"';
         }
         return (
            pck +
            ";\n" +
            term.statements
               .map((statement) => this.translate(statement, scope))
               .filter((s) => s)
               .join(";\n")
         );
      } else if (term instanceof Import) {
         return "";
      } else if (term instanceof TypeDef) {
         return `type ${term.name} struct {
				${(term.fieldDefs || []).map((field) => {
               return `${field.name} ${this.translate(field.type, scope)}`;
            })}
			}`;
      } else if (term instanceof RoundApply) {
         let args: ([string, Term] | undefined)[] = [];
         if (term.paramOrder.length === 0) {
            args = term.args;
         } else {
            for (let [from, to] of term.paramOrder) {
               args[to] = term.args[from];
            }
         }
         for (let i = 0; i < args.length; i++) {
            if (!Object.hasOwn(args, i)) {
               args[i] = undefined;
            }
         }

         let L = "(";
         let R = ")";
         if (
            term.callee instanceof Identifier &&
            term.callee.isTypeIdentifier()
         ) {
            L = "{";
            R = "}";
         }
         return `${this.translate(term.callee, scope)}${L}${term.args.map(
            ([name, value]) =>
               `${name ? name + ": " : ""}${this.translate(value, scope)}`
         )}${R}`;
      } else if (
         term instanceof RoundValueToValueLambda &&
         term.inferredType instanceof RoundValueToValueLambdaType
      ) {
         return `func ${this.translate(
            new Identifier(term.name!),
            scope
         )}(${term.params.map((p) => this.translate(p, scope))})${
            term.inferredType.returnType === NamedType.PRIMITIVE_TYPES.Nothing
               ? ""
               : this.translate(term.inferredType.returnType, scope)
         }{\n${this.translate(term.block, scope)}\n}`;
      } else if (term instanceof NamedType) {
         if (Object.keys(this.identifierMap).includes(term.name)) {
            return this.identifierMap[term.name];
         }
         return term.name;
      }
      return "nil";
   }
}
