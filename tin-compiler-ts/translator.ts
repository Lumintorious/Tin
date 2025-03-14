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
   RoundValueToValueLambda,
   RoundTypeToTypeLambda,
   IfStatement,
   BinaryExpression,
   RoundApply,
   FieldDef,
   SquareApply,
   SquareTypeToTypeLambda,
   Term,
} from "./Parser";
import {
   WhileLoop,
   SquareTypeToValueLambda,
   Change,
   DataDef,
   Optional,
} from "./Parser";
import { getConstructorName } from "./TypeChecker";
import { Make, Identifier, TypeCheck, Import } from "./Parser";
import { Scope } from "./Scope";

export function translateFile(fileStatementsBlock: Block, scope: Scope) {
   const requisites = fs.readFileSync("./tin-compiler-ts/tin.stdlib.js");
   return requisites + ";\n" + translate(fileStatementsBlock, scope);
}

function createConstructor(typeDef: TypeDef, scope: Scope): string {
   if (typeDef.fieldDefs.length === 0) {
      return "() => undefined";
   }

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
         (!isAssignment &&
         args &&
         args.returnLast &&
         !(last instanceof WhileLoop)
            ? "return "
            : "") + `${translate(last, scope)}`,
      ].join(";\n");

      // Group
   } else if (term instanceof Group) {
      return `(${translate(term.value, scope)})`;

      // Select
   } else if (term instanceof Select) {
      const operator = term.ammortized ? "?." : ".";
      if (!term.ownerComponent) {
         console.error(term);
         throw new Error("Attempted select on object without components: ");
      }
      return `${translate(term.owner, scope)}${operator}${
         term.ownerComponent
      }${operator}${term.field}`;

      // Make
   } else if (term instanceof Make) {
      if (term.type instanceof Identifier) {
         return term.type.value;
      } else {
         throw new Error("Can only use make with a named type. eg. 'Cat'");
      }

      // SquareTypeToValueLambda
   } else if (term instanceof SquareTypeToValueLambda) {
      return `function(${term.parameterTypes
         .map((p) => translate(p, scope.innerScopeOf(term, true)))
         .join(", ")}) {\n${translate(
         term.block,
         scope.innerScopeOf(term, true),
         {
            returnLast: true,
         }
      )}\n}`;

      // Change
   } else if (term instanceof Change) {
      return `${translate(term.lhs, scope)} = ${translate(term.value, scope)}`;

      // Assignment
   } else if (term instanceof Assignment) {
      if (
         term.value instanceof Literal &&
         term.value.value === "" &&
         term.value.type === "Any"
      ) {
         return "";
      }
      let keyword = term.isDeclaration ? "var " : "";
      const scopeDots = [...(scope.toPath().matchAll(/\./g) || [])].length;
      const doExport = scopeDots < 2 && term.isDeclaration ? "export " : "";
      keyword = doExport + keyword;
      const lhs = translate(term.lhs, scope);
      const value = term.value ? " = " + translate(term.value, scope) : "";
      let type = "";
      if (!term.isTypeLevel) {
         try {
            const symbol = term.isDeclaration ? term.symbol : scope.lookup(lhs);
            type =
               "/* " +
               (symbol !== undefined ? symbol.typeSymbol.toString() : "???") +
               "*/";
         } catch (e) {
            //
         }
      }
      const constructorName = getConstructorName(lhs);
      let declareConstructor = "";
      if (term.value instanceof TypeDef) {
         declareConstructor = ""; //`; var ${constructorName} = ${lhs};`;
      } else if (
         term.value instanceof SquareTypeToTypeLambda &&
         term.value.returnType instanceof TypeDef
      ) {
         const surrogateFunc = new SquareTypeToValueLambda(
            term.value.parameterTypes,
            new Block([new SquareApply(term.lhs, term.value.parameterTypes)])
         );
         declareConstructor = "";
         // `; var ${constructorName} = ${translate(
         //    surrogateFunc,
         //    scope
         // )};`;
      }
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
      // if (term.value === "this") {
      //    return "$this";
      // }
      return term.value.replaceAll("@", "$");

      // RoundValueToValueLambda
   } else if (term instanceof RoundValueToValueLambda) {
      const params = term.isFirstParamThis()
         ? term.params.slice(1, term.params.length)
         : term.params;
      return `function(${params
         .map((p) => translate(p, scope.innerScopeOf(term, true)))
         .join(", ")}) {\n${translate(
         term.block,
         scope.innerScopeOf(term, true),
         {
            returnLast: true,
         }
      )}\n}`;

      //RoundTypeToTypeLambda
   } else if (term instanceof RoundTypeToTypeLambda) {
      return `TIN_LAMBDA_TYPE("Lambda", [${term.parameterTypes
         .map((t) => translate(t, scope.innerScopeOf(term, true)))
         .join(", ")}], ${translate(
         term.returnType,
         scope.innerScopeOf(term, true)
      )})`;

      // SquareTypeToTypeLambda
   } else if (term instanceof SquareTypeToTypeLambda) {
      return `/* [] */(${term.parameterTypes
         .map((t) => translate(t, scope.innerScopeOf(term, true)))
         .join(", ")}) => ${translate(
         term.returnType,
         scope.innerScopeOf(term, true)
      )}`;

      // IfStatement
   } else if (term instanceof IfStatement) {
      let trueBranch = "";
      if (
         term.trueBranch instanceof Block &&
         term.trueBranch.statements.length > 1
      ) {
         trueBranch = `((function(){${translate(term.trueBranch, scope, {
            returnLast: true,
         })}}).call(this))`;
      } else {
         trueBranch = `(${translate(term.trueBranch, scope)})`;
      }
      let falseBranch = "";
      if (
         term.falseBranch instanceof Block &&
         term.falseBranch.statements.length > 1
      ) {
         falseBranch = `((function(){${translate(term.falseBranch, scope, {
            returnLast: true,
         })}})())`;
      } else {
         falseBranch = `(${translate(term.falseBranch, scope)})`;
      }
      return `((${translate(
         term.condition,
         scope
      )}) ? ${trueBranch} : ${falseBranch}) `;

      // BinaryExpression
   } else if (term instanceof WhileLoop) {
      const innerScope = scope.innerScopeOf(term, true);
      let parts = translate(term.condition, innerScope);
      if (term.start && term.eachLoop) {
         parts =
            translate(term.start, innerScope) +
            ";" +
            parts +
            ";" +
            translate(term.eachLoop, innerScope);
      }
      return `${
         term.start !== undefined ? "for" : "while"
      } (${parts}) {\n ${translate(term.action, innerScope)} \n}`;

      // BinaryExpression
   } else if (term instanceof BinaryExpression) {
      return translateBinaryExpression(term, scope);

      // RoundApply
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
      // console.log(args);
      const takesVarargs = term.takesVarargs;
      let open = takesVarargs ? "(Array(0)([" : "(";
      const close = takesVarargs ? "]))" : ")";
      if (term.isFirstParamThis && term.callee instanceof Select) {
         open = ".call(" + translate(term.callee.owner, scope);
      }
      return (
         translate(term.callee, scope) +
         (term.calledInsteadOfSquare || term.autoFilledSquareParams
            ? "(0)"
            : "") +
         (term.isAnObjectCopy ? "._copy" : "") +
         open +
         args
            .map((arg) => {
               return !arg ? "undefined" : translate(arg[1], scope);
            })
            .join(", ") +
         close
      );

      // SquareApply
   } else if (term instanceof SquareApply) {
      return (
         translate(term.callee, scope) +
         ".call('Type', " +
         term.typeArgs.map((arg) => translate(arg, scope)).join(", ") +
         ")"
      );

      // TypeDef
   } else if (term instanceof TypeDef) {
      return `TIN_TYPE("${term.name}", "${randomUUID()}", ${createConstructor(
         term,
         scope
      )}, {${/*term.fieldDefs.map((f) => translate(f, scope))*/ ""}}); ${
         term.name
      }._typeId = "${term.name}";`;

      // DataDef
   } else if (term instanceof DataDef) {
      return `{${term.fieldDefs.map(
         (f) => `${f.name}: ${translate(f.defaultValue, scope)}`
      )}}`;

      // FieldDef
   } else if (term instanceof FieldDef) {
      return `${term.name}: { type: ${translate(
         term.type,
         scope
      )}, defaultValue: ${translate(term.defaultValue, scope)} }`;

      // Optional
   } else if (term instanceof Optional) {
      if (term.expression.isTypeLevel || !term.doubleQuestionMark) {
         return translate(term.expression, scope);
      } else {
         return `(${translate(term.expression, scope)} !== undefined)`;
      }
      // TypeCheck
   } else if (term instanceof TypeCheck) {
      return `${translate(term.type, scope)}.__is_child(${translate(
         term.term,
         scope
      )}) `;
      // Undefined
   } else if (term instanceof Import) {
      return `import * as module${moduleNumber} from "file://${term.path
         .replaceAll("\\", "\\\\")
         .replaceAll(
            "\\src\\",
            "\\tin-out\\"
         )}.tin.out.js";Object.entries(module${moduleNumber++}).forEach(([key, value]) => {
			globalThis[key] = value;
	  });`;
      // Undefined
   } else {
      return "(? " + term.tag + " ?)";
   }
}
let moduleNumber = 0;

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
         new RoundApply(new Identifier("_TIN_UNION_OBJECTS"), [
            ["", term.left],
            ["", term.right],
         ]),
         scope
      );
   }
   if (term.operator === "&") {
      return `_TIN_INTERSECT_OBJECTS(${translate(
         term.left,
         scope
      )}, ${translate(term.right, scope)})`;
   }
   if (term.operator === "?:") {
      return `${translate(term.left, scope)} ?? ${translate(
         term.right,
         scope
      )}`;
   }

   if (
      ![
         "+",
         "-",
         "*",
         "**",
         "/",
         "&&",
         "||",
         "->",
         "<",
         ">",
         "<=",
         ">=",
         "==",
         "!=",
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
