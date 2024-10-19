import fs from "node:fs";
import { randomUUID } from "crypto";
import {
   Block,
   AstNode,
   TypeDef,
   AppliedKeyword,
   Assignment,
   Group,
   Select,
   Literal,
   Cast,
   Identifier,
   Lambda,
   LambdaTypeTerm,
   IfStatement,
   BinaryExpression,
   Apply,
   FieldDef,
} from "./Parser";
import { Scope } from "TypeChecker";

export function translateFile(fileStatementsBlock: Block, scope: Scope) {
   const requisites = fs.readFileSync("./tin-compiler-ts/tin.stdlib.js");
   return requisites + ";\n" + translate(fileStatementsBlock, scope);
}

function createConstructor(typeDef: TypeDef, scope: Scope): string {
   const parameters =
      "(" +
      typeDef.fieldDefs.map((param, i) => {
         return `_p${i}${
            param.defaultValue
               ? " = " + translate(param.defaultValue, scope)
               : ""
         }`;
      }) +
      ")";

   return (
      parameters +
      " => ({" +
      typeDef.fieldDefs.map((param, i) => {
         return `${param.name}: _p${i}`;
      }) +
      "})"
   );
}

function translate(
   term: AstNode | undefined,
   scope: Scope,
   args: any = {}
): string {
   if (term === undefined || term === null) {
      return "undefined";
   }
   // AppliedKeywords
   if (term instanceof AppliedKeyword) {
      return `${term.keyword} (${translate(term.param, scope)})`;

      // Block
   } else if (term instanceof Block) {
      let last = term.statements.pop();
      const isAssignment = last instanceof Assignment;
      return [
         ...term.statements.map((st) => translate(st, scope)),
         (!isAssignment && args && args.returnLast ? "return " : "") +
            `${translate(last, scope)}`,
      ].join(";\n");

      // Group
   } else if (term instanceof Group) {
      return `(${translate(term.value, scope)})`;

      // Select
   } else if (term instanceof Select) {
      return `${translate(term.owner, scope)}.${term.field}`;

      // Assignment
   } else if (term instanceof Assignment) {
      const keyword = term.isDeclaration ? "var " : "";
      const lhs = translate(term.lhs, scope);
      const value = term.value ? " = " + translate(term.value, scope) : "";
      const symbol = term.symbol;
      const type =
         "/* " +
         (symbol !== undefined ? symbol.typeSymbol.toString() : "???") +
         "*/";

      const declareConstructor =
         term.value instanceof TypeDef ? `; var make${lhs} = ${lhs};` : "";
      return keyword + lhs + type + value + declareConstructor;

      // Literal
   } else if (term instanceof Literal) {
      if (term.type === "String") {
         return `"${term.value}"`;
      } else if (term.type === "Number" || term.type === "Boolean") {
         return `${term.value}`;
      } else {
         return "null";
      }

      // Cast
   } else if (term instanceof Cast) {
      return `(${translate(term.expression, scope)}) /* as ${translate(
         term.type,
         scope
      )} */`;

      // Identifier
   } else if (term instanceof Identifier) {
      return term.value;

      // Lambda
   } else if (term instanceof Lambda) {
      return `function(${term.params
         .map((p) => translate(p, scope.innerScopeOf(term)))
         .join(", ")}) {\n${translate(term.block, scope.innerScopeOf(term), {
         returnLast: true,
      })}\n}`;

      //LambdaTypeTerm
   } else if (term instanceof LambdaTypeTerm) {
      return `(${term.parameterTypes
         .map((t) => translate(t, scope))
         .join(", ")}) => ${translate(term.returnType, scope)}`;

      // IfStatement
   } else if (term instanceof IfStatement) {
      return `((${translate(term.condition, scope)}) ? (${translate(
         term.trueBranch,
         scope
      )}) : (${translate(term.falseBranch, scope)})) `;

      // BinaryExpression
   } else if (term instanceof BinaryExpression) {
      return translateBinaryExpression(term, scope);

      // Apply
   } else if (term instanceof Apply) {
      const takesVarargs = term.takesVarargs;
      const open = takesVarargs ? "(Array([" : "(";
      const close = takesVarargs ? "]))" : ")";
      return (
         translate(term.callee, scope) +
         open +
         term.args.map((arg) => translate(arg, scope)).join(", ") +
         close
      );

      // TypeDef
   } else if (term instanceof TypeDef) {
      return `TIN_TYPE("${randomUUID()}", ${createConstructor(
         term,
         scope
      )}, {${term.fieldDefs.map((f) => translate(f, scope))}})`;

      // FieldDef
   } else if (term instanceof FieldDef) {
      return `${term.name}: { type: ${translate(
         term.type,
         scope
      )}, defaultValue: ${translate(term.defaultValue, scope)} }`;

      // Undefined
   } else {
      return "(? " + term.tag + " ?)";
   }
}

function translateBinaryExpression(
   term: BinaryExpression,
   scope: Scope
): string {
   if (term.operator === "=" && term.left instanceof Identifier) {
      return `const ${term.left.value} ${
         term.left instanceof Cast
            ? term.left.type
               ? "/*" + term.left.type + "*/"
               : ""
            : ""
      } = ${translate(term.right, scope)}`;
   }
   if (term.operator === "|") {
      return translate(
         new Apply(new Identifier("_TIN_UNION_OBJECTS"), [
            term.left,
            term.right,
         ]),
         scope
      );
   }
   if (term.operator === "&") {
      return translate(
         new Apply(new Identifier("_TIN_INTERSECT_OBJECTS"), [
            term.left,
            term.right,
         ]),
         scope
      );
   }
   if (
      ![
         "+",
         "-",
         "*",
         "/",
         "&&",
         "||",
         "->",
         "<",
         ">",
         "<=",
         ">=",
         ".",
      ].includes(term.operator)
   ) {
      return (
         translate(term.left, scope) +
         '["' +
         term.operator +
         '"](' +
         translate(term.right, scope) +
         ")"
      );
   }
   return (
      translate(term.left, scope) +
      " " +
      term.operator +
      " " +
      translate(term.right, scope)
   );
}
