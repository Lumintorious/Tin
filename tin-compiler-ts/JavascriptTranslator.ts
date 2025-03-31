import fs from "node:fs";
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
import {
   Make,
   Identifier,
   TypeCheck,
   Import,
   UnaryOperator,
   RefinedDef,
} from "./Parser";
import { Scope } from "./Scope";
import {
   Type,
   NamedType,
   StructType,
   ParamType,
   RoundValueToValueLambdaType,
   SquareTypeToValueLambdaType,
   MutableType,
   LiteralType,
} from "./Types";
import { OutputTranslator } from "./compiler";
import { exec } from "node:child_process";

export class JavascriptTranslator implements OutputTranslator {
   extension = "mjs";
   isStdLib: boolean = false;
   constructor(isStdLib: boolean = false) {
      this.isStdLib = isStdLib;
   }

   run(path: string): void {
      exec(
         'cd "tin-out"' +
            " && node --no-warnings --loader ../babel-loader.js " +
            path,
         (_, out, err) => {
            console.log(out);
            if (err) {
               console.log(err);
            }
         }
      );
   }

   createPrototype(
      typeDef: TypeDef,
      type: StructType,
      scope: Scope,
      isReflectiveType: boolean
   ): string {
      const L = "{";
      const R = "}";
      let result = "";
      if (isReflectiveType) {
         return "{}";
      }
      let i = 0;
      for (const field of typeDef.fieldDefs) {
         const fieldType = type.fields[i];
         const isPrimitive =
            fieldType instanceof NamedType && fieldType.isPrimitive();
         const isLambda =
            fieldType instanceof RoundValueToValueLambdaType ||
            fieldType instanceof SquareTypeToValueLambdaType;
         if (field.defaultValue && (isPrimitive || isLambda)) {
            result += `${field.name}: ${this.translate(
               field.defaultValue,
               scope
            )},`;
         }
         i++;
      }
      if (result.endsWith(",")) {
         result = result.substring(0, result.length - 1);
      }

      return L + result + R;
   }

   createConstructor(
      typeDef: TypeDef,
      type: StructType,
      scope: Scope,
      isReflectionType = false
   ): string {
      if (typeDef.fieldDefs.length === 0) {
         return "() => undefined";
      }

      const parameters =
         "(" +
         typeDef.fieldDefs.map((param, i) => {
            const fieldType = type.fields[i];
            const isPrimitive =
               fieldType instanceof NamedType && fieldType.isPrimitive();
            const isLambda =
               fieldType instanceof RoundValueToValueLambdaType ||
               fieldType instanceof SquareTypeToValueLambdaType;
            return `_p${i}${
               param.defaultValue &&
               !isReflectionType &&
               !isPrimitive &&
               !isLambda
                  ? " = " + this.translate(param.defaultValue, scope)
                  : ""
            }`;
         }) +
         ")";

      return (
         parameters +
         " => _o({" +
         typeDef.fieldDefs.map((param, i) => {
            return `${param.name}: _p${i}`;
         }) +
         "})"
      );
   }

   translate(
      term: AstNode | Type | undefined,
      scope: Scope,
      args: any = {}
   ): string {
      let result = this.translateRaw(term, scope, args);

      if (term instanceof Term && term.capturedName !== undefined) {
         result = `{_:(${result}),_cn:"${term.capturedName}"}`;
      } else if (term instanceof Term && term.invarTypeInVarPlace) {
         result = `{_:(${result})}`;
      } else if (term instanceof Term && term.varTypeInInvarPlace) {
         result = "(" + result + ")._";
      }
      if (term instanceof Term && term.clojure) {
         result = `_makeClojure({${term.clojure
            .map((s) => s.name)
            .join(",")}}, ${result})`;
      }
      return result;
   }

   translateRaw(
      term: AstNode | Type | undefined,
      scope: Scope,
      args: any = {}
   ): string {
      if (term === undefined || term === null) {
         return "undefined";
      }
      if (term instanceof AppliedKeyword) {
         if (term.keyword === "unchecked") {
            return this.translate(term.param, scope);
         }
         if (term.keyword === "external" && term.param instanceof Literal) {
            return "\n" + String(term.param.value) + "\n";
         }
         if (term.keyword === "return") {
            return `throw ${this.translate(term.param, scope)}`;
         }
         return `${term.keyword} (${this.translate(term.param, scope)})`;

         // Block
      } else if (term instanceof Block) {
         let last = term.statements.pop();
         const isAssignment = last instanceof Assignment;
         const shouldReturn =
            !isAssignment &&
            args &&
            args.returnLast &&
            !(last instanceof WhileLoop || last instanceof AppliedKeyword);
         let result = [
            ...term.statements.map((st) => this.translate(st, scope)),
            (shouldReturn ? "throw " : "") +
               `${this.translate(last, scope)}` +
               (shouldReturn ? "" : ""),
         ].join(";\n");

         if (args.isTopLevel && this.isStdLib) {
            const requisites = fs.readFileSync("./tin-compiler-ts/stdlib.js");
            result = requisites + ";\n" + result;
         }

         return result;

         // Group
      } else if (term instanceof Group) {
         return `(${this.translate(term.value, scope)})`;

         // Select
      } else if (term instanceof Select) {
         const operator = term.ammortized ? "?." : ".";
         if (!term.ownerComponent && !term.unionOwnerComponents) {
            console.error(term);
            throw new Error(
               "Attempted select on object without components. Field = " +
                  term.field
            );
         }
         let selectionBase = "";
         if (term.ownerComponent) {
            selectionBase = `[${term.ownerComponent}._s]${operator}${term.field}`;
         } else if (term.unionOwnerComponents) {
            selectionBase = `._findComponentField([${term.unionOwnerComponents
               .filter((c) => c)
               .map((c) => `${c}._s`)
               .join(",")}], "${term.field}")`;
         }
         const termType = term.inferredType;
         if (
            !(
               term.owner instanceof Identifier &&
               term.owner.value.startsWith("_")
            )
         ) {
            console.log(termType?.toString());
         }
         if (!term.varTypeInInvarPlace) {
            selectionBase += "._";
         }
         return `${this.translate(term.owner, scope)}${selectionBase}`;

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
            .map((p) => this.translate(p, scope.innerScopeOf(term, true)))
            .join(", ")}) {try{\n${this.translate(
            term.block,
            scope.innerScopeOf(term, true),
            {
               returnLast: true,
            }
         )}\n} catch(e) { if(e instanceof Error) {throw e} else { return e} } }`;

         // Change
      } else if (term instanceof Change) {
         const termValueType = term.value.inferredType;
         const start = termValueType instanceof MutableType ? "(" : "";
         const ifTermValueMutable =
            termValueType instanceof MutableType ? ")._" : "";
         const isNotSelect = !(term.lhs instanceof Select);
         return `(${this.translate(term.lhs, scope)})${
            isNotSelect ? "._" : ""
         } = ${start}${this.translate(term.value, scope)}${ifTermValueMutable}`;

         // Assignment
      } else if (term instanceof Assignment) {
         if (
            term.value instanceof Literal &&
            term.value.value === "" &&
            term.value.type === "Anything"
         ) {
            return "";
         }
         let keyword = term.isDeclaration ? "var " : "";
         const scopeDots = [...(scope.toPath().matchAll(/\./g) || [])].length;
         const doExport = scopeDots < 2 && term.isDeclaration ? "export " : "";
         keyword = doExport + keyword;
         const lhs = this.translate(term.lhs, scope);
         const isMutable = term.type?.translatedType instanceof MutableType;
         function mutableWrapper(str: string) {
            if (isMutable) {
               return `{_:(${str})}`;
            } else {
               return str;
            }
         }
         const value = term.value
            ? " = " + mutableWrapper(this.translate(term.value, scope))
            : "";
         let type = "";
         if (!term.isTypeLevel) {
            try {
               const symbol = term.isDeclaration
                  ? term.symbol
                  : scope.lookup(lhs);
               type =
                  "/* " +
                  (symbol !== undefined
                     ? symbol.typeSymbol.toString()
                     : "???") +
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
               new Block([
                  new SquareApply(term.lhs, term.value.parameterTypes),
               ]),
               true
            );
            declareConstructor = "";
            // `; var ${constructorName} = ${this.translate(
            //    surrogateFunc,
            //    scope
            // )};`;
         }
         return keyword + lhs + type + value + declareConstructor;

         // Literal
      } else if (term instanceof Literal) {
         let rawDisplay = "";
         if (term.type === "String") {
            rawDisplay = `"${String(term.value).replaceAll(
               /[\r\n]+/g,
               "\\n"
            )}"`;
         } else if (term.type === "Number" || term.type === "Boolean") {
            rawDisplay = `${term.value}`;
         } else {
            rawDisplay = "null";
         }
         if (term?.isTypeLevel) {
            return "_L(" + rawDisplay + ")";
         } else {
            return rawDisplay;
         }

         // Cast
      } else if (term instanceof Cast) {
         return `${this.translate(
            term.expression,
            scope
         )} /* as ${this.translate(term.type, scope)} */`;

         // Identifier
      } else if (term instanceof Identifier) {
         const replacers: { [_: string]: string } = {
            // Type: "Type$",
         };
         let value = term.value.replaceAll("@", "$");
         if (Object.keys(replacers).includes(value)) {
            value = replacers[value];
         }
         if (term.isTypeIdentifier() && term.isInValueContext) {
            value = `Type$get(${value})`;
         }
         if (term.isFromSelfClojure) {
            value = `this._clojure.${value}`;
            // Otherwise "._" is added in the wrapper translate() (non-raw)
            if (!term.varTypeInInvarPlace) {
               value += "._";
            }
         }

         return value;

         // RoundValueToValueLambda
      } else if (term instanceof RoundValueToValueLambda) {
         if (!term.isTypeLambda) {
            const params = term.isFirstParamThis()
               ? term.params.slice(1, term.params.length)
               : term.params;
            return `_F(Symbol("lambda"), function(${params
               .map((p) => this.translate(p, scope.innerScopeOf(term, true)))
               .join(", ")}) {try{\n${this.translate(
               term.block,
               scope.innerScopeOf(term, true),
               {
                  returnLast: true,
               }
            )}\n} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, ${this.translateType(
               term.inferredType,
               scope
            )})`;
         } else {
            return `_F("Lambda", [${term.params
               .map((t) => this.translate(t, scope.innerScopeOf(term, true)))
               .join(", ")}], ${this.translate(
               term.block,
               scope.innerScopeOf(term, true)
            )})`;
         }

         // SquareTypeToTypeLambda
      } else if (term instanceof SquareTypeToTypeLambda) {
         return `/* [] */(function(){ const _sym = Symbol("${
            term.name
         }"); return _Q(_sym, (${term.parameterTypes
            .map((t) => this.translate(t, scope.innerScopeOf(term, true)))
            .join(", ")}) => ${this.translate(
            term.returnType,
            scope.innerScopeOf(term, true)
         )}); })()`;

         // IfStatement
      } else if (term instanceof IfStatement) {
         const isTrueBranchIf =
            term.trueBranch instanceof IfStatement ||
            (term.trueBranch instanceof Block &&
               term.trueBranch.statements[0] instanceof IfStatement);
         let trueBranch = `(function(){${this.translate(
            term.trueBranch,
            scope,
            {
               returnLast: !isTrueBranchIf,
            }
         )}})()`;
         const isFalseBranchIf =
            term.falseBranch instanceof IfStatement ||
            (term.falseBranch instanceof Block &&
               term.falseBranch.statements[0] instanceof IfStatement);
         let falseBranch = `(function(){${
            isFalseBranchIf ? "return " : ""
         }${this.translate(term.falseBranch, scope, {
            returnLast: !isFalseBranchIf,
         })}})()`;
         // if (
         //    term.trueBranch instanceof Block &&
         //    term.trueBranch.statements.length > 1
         // ) {
         //    trueBranch = `((function(){${this.translate(
         //       term.trueBranch,
         //       scope,
         //       {
         //          returnLast: !term.trueBranch.skipReturn,
         //       }
         //    )}}).call(this))`;
         // } else {
         //    trueBranch = `(${this.translate(term.trueBranch, scope)})`;
         // }
         // let falseBranch = "";
         // if (
         //    term.falseBranch instanceof Block &&
         //    term.falseBranch.statements.length > 1
         // ) {
         //    falseBranch = `((function(){${this.translate(
         //       term.falseBranch,
         //       scope,
         //       {
         //          returnLast: !term.falseBranch.skipReturn,
         //       }
         //    )}})())`;
         // } else {
         //    falseBranch = `(${this.translate(term.falseBranch, scope)})`;
         // }
         return `((${this.translate(
            term.condition,
            scope
         )}) ? ${trueBranch} : ${falseBranch}) `;

         // BinaryExpression
      } else if (term instanceof WhileLoop) {
         const innerScope = scope.innerScopeOf(term, true);
         let parts = this.translate(term.condition, innerScope);
         if (term.start && term.eachLoop) {
            parts =
               this.translate(term.start, innerScope) +
               ";" +
               parts +
               ";" +
               this.translate(term.eachLoop, innerScope);
         }
         return `${
            term.start !== undefined ? "for" : "while"
         } (${parts}) {\n ${this.translate(term.action, innerScope)} \n}`;

         // BinaryExpression
      } else if (term instanceof BinaryExpression) {
         return this.translateBinaryExpression(term, scope);

         // RoundApply
      } else if (term instanceof RoundApply) {
         let params: ([string, Term] | undefined)[] = [];
         if (term.paramOrder.length === 0) {
            params = term.args;
         } else {
            for (let [from, to] of term.paramOrder) {
               params[to] = term.args[from];
            }
         }
         for (let i = 0; i < params.length; i++) {
            if (!Object.hasOwn(params, i)) {
               params[i] = undefined;
            }
         }
         const takesVarargs = term.takesVarargs;
         let open = takesVarargs ? "(Array(0)([" : "(";
         const close = takesVarargs ? "]))" : ")";
         let openWrapper = "";
         let closeWrapper = "";
         let callee = term.callee;
         if (term.callee instanceof Select) {
            openWrapper =
               "((() => { var _owner = " +
               this.translate(term.callee.owner, scope) +
               "; return ";
            closeWrapper = "})())";
            callee = new Select(
               new Identifier("_owner"),
               term.callee.field,
               term.callee.ammortized
            );
            callee.capturedName = term.callee.capturedName;
            callee.varTypeInInvarPlace = term.callee.varTypeInInvarPlace;
            callee.invarTypeInVarPlace = term.callee.invarTypeInVarPlace;
            open =
               ".call(" + this.translate((callee as Select).owner, scope) + ",";
            (callee as Select).ownerComponent = term.callee.ownerComponent;
            (callee as Select).isTypeLevel = term.callee.isTypeLevel;
         }
         if (
            term.isCallingAConstructor &&
            term.callee instanceof Identifier &&
            term.callee.isTypeIdentifier()
         ) {
            term.callee.isInValueContext = false;
         }
         if (args.thisToPass) {
            open = ".call(" + args.thisToPass + ", ";
         } else if (term.bakedInThis) {
            open = ".call(" + this.translate(term.bakedInThis, scope) + ", ";
         }
         return (
            openWrapper +
            this.translate(callee, scope) +
            (term.autoFilledSquareParams
               ? `.call(${term.autoFilledSquareParams
                    .map((type) => this.translateType(type, scope))
                    .join(",")})`
               : "") +
            open +
            params
               .map((arg) => {
                  return !arg ? "undefined" : this.translate(arg[1], scope);
               })
               .join(", ") +
            close +
            closeWrapper
         );

         // SquareApply
      } else if (term instanceof SquareApply) {
         return (
            this.translate(term.callee, scope) +
            ".call('Type', " +
            term.typeArgs.map((arg) => this.translate(arg, scope)).join(", ") +
            ")"
         );

         // TypeDef
      } else if (term instanceof TypeDef) {
         return `_S(typeof _sym !== "undefined" ? _sym : Symbol("${
            term.name
         }"), ${this.createConstructor(
            term,
            term.translatedType as StructType,
            scope,
            this.isStdLib
         )}, lazy(${
            this.isStdLib
               ? "{isReflectionType: true}"
               : this.translateType(term.translatedType, scope)
         }), ${this.createPrototype(
            term,
            term.translatedType as StructType,
            scope,
            this.isStdLib
         )})`;

         // DataDef
      } else if (term instanceof DataDef) {
         return `{${term.fieldDefs.map(
            (f) => `${f.name}: ${this.translate(f.defaultValue, scope)}`
         )}}`;

         // FieldDef
      } else if (term instanceof FieldDef) {
         return `${term.name}: { type: ${this.translate(
            term.type,
            scope
         )}, defaultValue: ${this.translate(term.defaultValue, scope)} }`;

         // RefinedDef
      } else if (term instanceof RefinedDef) {
         return `{__is_child:${this.translate(term.lambda, scope)}}`;

         // Optional
      } else if (term instanceof Optional) {
         if (term.expression.isTypeLevel || !term.doubleQuestionMark) {
            return this.translate(term.expression, scope);
         } else {
            return `(${this.translate(term.expression, scope)} !== undefined)`;
         }
         // TypeCheck
      } else if (term instanceof TypeCheck) {
         return `${this.translate(
            term.type,
            scope
         )}.__is_child(${this.translate(term.term, scope)}) `;
         // Undefined
      } else if (term instanceof Import) {
         return `import * as module${this.moduleNumber} from "file://${term.path
            .replaceAll("\\", "\\\\")
            .replaceAll(
               "\\src\\",
               "\\tin-out\\"
            )}.tin.out.mjs";Object.entries(module${this
            .moduleNumber++}).forEach(([key, value]) => {
				globalThis[key] = value;
		  });`;
         // Undefined
      } else if (term instanceof UnaryOperator) {
         if (term.operator === "var") {
            const v = term.invarTypeInVarPlace;
            return (
               (!v ? "{_:(" : "") +
               this.translate(term.expression, scope) +
               (!v ? ")}" : "")
            );
         } else {
            return "(? " + term.tag + " " + term.operator + " ?)";
         }
      } else {
         return "(? " + term.tag + " ?)";
      }
   }

   translateType(type: Type | ParamType | undefined, scope: Scope): string {
      if (type instanceof NamedType) {
         return "" + type.name;
      } else if (type instanceof StructType) {
         return `Type('${type.name}', (obj) => Reflect.ownKeys(obj).includes(${
            type.name
         }._s))._and(Struct(Array(0)([
						${type.fields.map((f) => `${this.translateType(f, scope)}`)}
			])))`;
      } else if (type instanceof ParamType) {
         return `Parameter("${type.name ?? undefined}",
					Type$of(${this.translateType(type.type, scope)}),
					() => { return (${
                  type.defaultValue
                     ? this.translate(type.defaultValue, scope)
                     : undefined
               })})
		`;
      } else if (type instanceof RoundValueToValueLambdaType) {
         return `
				Type("${type.name}")._and(Lambda(
				Array(Type)([${type.params.map((f) => `${this.translateType(f, scope)},`)}]),
				${this.translateType(type.returnType, scope)}))
			`;
      }

      return "{}";
   }

   wrapType(tag: String, contents: String) {
      return `{
			Type: {
				tag: "${tag}",
				${contents.trim()}
			}
		}`;
   }

   moduleNumber = 0;

   translateBinaryExpression(term: BinaryExpression, scope: Scope): string {
      if (term.operator === "=" && term.left instanceof Identifier) {
         return `var ${term.left.value} ${
            term.left instanceof Cast
               ? term.left.type
                  ? "/*" + term.left.type + "*/"
                  : ""
               : ""
         } = ${this.translate(term.right, scope)}`;
      }
      if (term.operator === "|") {
         if (
            term.isTypeLevel ||
            (term.left.isTypeLevel && term.right.isTypeLevel)
         ) {
            return this.translate(
               new RoundApply(new Identifier("_U"), [
                  ["", term.left],
                  ["", term.right],
               ]),
               scope
            );
         } else {
            return `(${this.translate(term.left, scope)} ?? ${this.translate(
               term.right,
               scope
            )})`;
         }
      }
      if (term.operator === "&") {
         let reflectMarker = "";
         if (this.isStdLib) {
            reflectMarker = ", true";
         }
         return `(() => { const _left = ${this.translate(
            term.left,
            scope
         )}; return _A(_left, ${this.translate(term.right, scope, {
            thisToPass: "_left",
         })}${reflectMarker});})()`;
      }
      if (term.operator === "?:") {
         return `${this.translate(term.left, scope)} ?? ${this.translate(
            term.right,
            scope
         )}`;
      }

      if (term.operator === "copy") {
         return `copy(${this.translate(term.left, scope)},${this.translate(
            term.right,
            scope
         )})`;
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
            this.translate(term.left, scope) +
            '["' +
            term.operator +
            '"](' +
            this.translate(term.right, scope) +
            ")"
         );
      }
      return (
         this.translate(term.left, scope) +
         " " +
         term.operator +
         " " +
         this.translate(term.right, scope)
      );
   }
}
