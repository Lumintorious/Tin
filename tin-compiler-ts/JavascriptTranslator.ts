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
   Call,
   FieldDef,
   SquareTypeToTypeLambda,
   Term,
   Tuple,
   VAR_RETURNING_FUNC_IN_INVAR_PLACE,
   INVAR_RETURNING_FUNC_IN_VAR_PLACE,
   IN_RETURN_BRANCH,
   ARTIFICIAL,
   WHERE_INTERPOLATION_EXPECTED,
   IN_TYPE_CONTEXT,
} from "./Parser";
import pth from "path";
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
import { Scope, Symbol } from "./Scope";
import {
   Type,
   NamedType,
   StructType,
   ParamType,
   RoundValueToValueLambdaType,
   SquareTypeToValueLambdaType,
   MutableType,
   SingletonType,
   RefinedType,
   PrimitiveType,
   IntersectionType,
   AppliedGenericType,
   AnyType,
   OptionalType,
   GenericNamedType,
} from "./Types";
import { OutputTranslator } from "./compiler";
import { exec, spawn } from "node:child_process";

export class JavascriptTranslator implements OutputTranslator {
   extension = "mjs";
   isStdLib: boolean = false;
   fileName: string;
   constructor(fileName: string, isStdLib: boolean = false) {
      this.isStdLib = isStdLib;
      this.fileName = fileName;
   }

   getOutputFileName(inputFileName: string): string {
      return inputFileName + ".out." + this.extension;
   }

   run(path: string, isTest?: boolean): void {
      const child = spawn("bun", ["run", path], {
         cwd: `tin-out${isTest ? "-tests" : ""}`,
         stdio: "inherit",
      });
      //   exec(
      //      `cd "tin-out${isTest ? "-tests" : ""}"` + " && bun run " + path,
      //      (_, out, err) => {
      //         console.log(out);
      //         if (err) {
      //            console.log(err);
      //         }
      //      }
      //   );
   }

   accessMutable = "._";
   makeMutable(value: string, condition: boolean) {
      if (condition) {
         return `_var([], () => ${value}, true)`;
      } else {
         return value;
      }
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
         const isPrimitive = fieldType instanceof PrimitiveType;
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
      //   if (typeDef.fieldDefs.length === 0) {
      //      return "() => undefined";
      //   }

      const parameters =
         "(" +
         typeDef.fieldDefs.map((param, i) => {
            const fieldType = type.fields[i];
            const isPrimitive = fieldType instanceof PrimitiveType;
            const isLambda =
               fieldType instanceof RoundValueToValueLambdaType ||
               fieldType instanceof SquareTypeToValueLambdaType;
            return `_p${i}${
               fieldType.type instanceof OptionalType &&
               !isReflectionType &&
               !isPrimitive &&
               !isLambda
                  ? " = _var([], () => undefined, true)"
                  : ""
            }`;
         }) +
         ")";

      return (
         parameters +
         " => _o({" +
         typeDef.fieldDefs.map((param, i) => {
            return `${this.doReplacing(param.name)}: _p${i}`;
         }) +
         "})"
      );
   }

   baseX =
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~!@#$%^&*()_+{}|;:.>/?";

   encodeBase62(num: number) {
      let str = "";
      do {
         str = this.baseX[num % this.baseX.length] + str;
         num = Math.floor(num / this.baseX.length);
      } while (num > 0);
      return str;
   }

   makeClojureIdent(sym: Symbol) {
      const str = `${this.fileName}:${sym.position?.start.line}:${sym.position?.start.column}`;
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
         hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
      }
      return this.encodeBase62(hash);
   }

   hashLocation(file: string, line: number, col: number) {}

   translate(
      term: AstNode | Type | undefined,
      scope: Scope,
      args: any = {}
   ): string {
      let result = this.translateRaw(term, scope, args);

      if (term instanceof Term) {
         if (term instanceof Identifier && term.is(IN_TYPE_CONTEXT)) {
            result = `_L(${result}, "${term.value}")`;
         }

         if (term.is(INVAR_RETURNING_FUNC_IN_VAR_PLACE)) {
            result = `(function(...args) {
			   const _res = (${result}).call(this, ...args);
			   return ${this.makeMutable("_res", true)};
			})`;
         } else if (term.is(VAR_RETURNING_FUNC_IN_INVAR_PLACE)) {
            result = `(function(...args) { 
				const _res = (${result}).call(this, ...args);
				return _res${this.accessMutable};
			})`;
         }
         if (
            term.capturedName !== undefined &&
            !(term instanceof AppliedKeyword && term.keyword === "return")
         ) {
            let clojureName = "";
            let isMutable = false;
            if (term instanceof Identifier) {
               const symbol = scope.lookup(term.value);
               isMutable = symbol.typeSymbol instanceof MutableType;
               clojureName = this.makeClojureIdent(symbol);
            }
            if (!isMutable) {
               result = `_var(/*44*/[], () => ${result},false, '${clojureName}')`;
            }
         } else if (
            term.invarTypeInVarPlace &&
            !(term instanceof AppliedKeyword && term.keyword === "return")
         ) {
            result = `_var([], () => ${result}, true)`;
         } else if (term.varTypeInInvarPlace) {
            result = "(" + result + ")" + this.accessMutable;
         }

         if (term.clojure) {
            result = `_makeClojure({${term.clojure
               .filter(
                  (s) =>
                     (s.isUsedInClojures &&
                        s.isSentToConstructors &&
                        s.name.startsWith("@")) ||
                     s.typeSymbol instanceof MutableType
               )
               .map(
                  (s) =>
                     `"${this.makeClojureIdent(s)}":${s.name.replaceAll(
                        "@",
                        "$"
                     )}`
               )
               .join(",")}}, ${result})`;
         }
      }
      return result;
   }

   nameReplacers: { [_: string]: string } = {
      // Type: "Type$",
      this: "this_",
      // self: "this",
      Error: "TinErr_",
      Map: "Map_",
      //   toString: "tinToString_",
   };

   doReplacing(str: string): string {
      if (Object.keys(this.nameReplacers).includes(str)) {
         return this.nameReplacers[str];
      } else {
         return str;
      }
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
         let last = term.statements[term.statements.length - 1];
         scope = scope.innerScopeOf(term);
         const isTerm = last instanceof Term;
         const shouldReturn =
            isTerm &&
            args &&
            args.returnLast &&
            !(last instanceof WhileLoop || last instanceof AppliedKeyword);
         const forceReturn = args.forceReturn;
         let result = [
            ...term.statements
               .slice(0, term.statements.length - 1)
               .map((st) => this.translate(st, scope)),
            (shouldReturn ? (args.normalReturn ? "return " : "throw ") : "") +
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
         let ownerName = this.translate(term.owner, scope);
         if (term.field === "Type") {
            return `Type$of(${ownerName}, ${term.ammortized === true})`;
         }
         if (
            !term.ownerComponent &&
            !term.unionOwnerComponents &&
            !term.isDeclaration &&
            !term.isBeingTreatedAsIdentifier
         ) {
            console.error(term);
            throw new Error(
               "Attempted select on object without components. Field = " +
                  term.field
            );
         }
         let selectionBase = "";
         if (term.isDeclaration) {
            selectionBase = `${term
               .nameAsSelectOfIdentifiers()
               ?.replaceAll(".", "$")}`;
            ownerName = "";
         } else if (term.ownerComponent) {
            let symbolSplice = `${
               Object.keys(this.nameReplacers).includes(term.ownerComponent)
                  ? this.nameReplacers[term.ownerComponent]
                  : term.ownerComponent
            }._s`;
            selectionBase = `[${symbolSplice}]${operator}${this.doReplacing(
               term.field
            )}`;
         }
         if (
            !term.varTypeInInvarPlace &&
            !term.isDeclaration &&
            !term.isTypeLevel
         ) {
            selectionBase += this.accessMutable;
         }

         let result = `${ownerName}${selectionBase}`;
         if (term.ammortized) {
            result = `(function() { const _amm_owner = ${ownerName}; return TinErr_.__is_child(_amm_owner) ? (_amm_owner) : (_amm_owner${selectionBase})}).call(this)`;
         }
         if (term.is(IN_TYPE_CONTEXT)) {
            result = `_L(${result}, "${term.nameAsSelectOfIdentifiers()}")`;
         }
         return result;
         // Make
      } else if (term instanceof Make) {
         if (term.type instanceof Identifier) {
            return term.type.value;
         } else {
            throw new Error("Can only use make with a named type. eg. 'Cat'");
         }

         // SquareTypeToValueLambda
      } else if (term instanceof SquareTypeToValueLambda) {
         scope = scope.innerScopeOf(term);
         return `(function(${term.parameterTypes
            .map((p) => this.translate(p, scope.innerScopeOf(term, true)))
            .join(", ")}) {try{\n${this.translate(
            term.block,
            scope.innerScopeOf(term, true),
            {
               returnLast: true,
            }
         )}\n} catch(e) { if(e instanceof Error) {throw e} else { return e} } })`;

         // Change
      } else if (term instanceof Change) {
         const termValueType = term.value.inferredType;
         const start = termValueType instanceof MutableType ? "(" : "";
         const ifTermValueMutable =
            termValueType instanceof MutableType
               ? ")" + this.accessMutable
               : "";
         const isNotSelect = !(term.lhs instanceof Select);
         const isArtificial = term.at(ARTIFICIAL);
         let lhs = this.translate(term.lhs, scope);
         const rhs = this.translate(term.value, scope);
         const rhsIfMutable = `${start}${rhs}${ifTermValueMutable}`;
         if (isArtificial) {
            return `${lhs} = ${rhs}`;
         } else {
            if (lhs.endsWith(this.accessMutable)) {
               lhs = lhs.substring(0, lhs.length - 2);
            }
            return `_set(${lhs}, ${rhsIfMutable})`;
         }

         // Assignment
      } else if (term instanceof Assignment) {
         if (
            (term.value instanceof Literal &&
               term.value.value === "" &&
               term.value.type === "Anything") ||
            (term.lhs instanceof Identifier && term.lhs.value === "Seq")
         ) {
            return "";
         }
         let keyword = term.isDeclaration ? "var " : "";
         const scopeDots = [...(scope.toPath().matchAll(/\./g) || [])].length;
         const doExport = scopeDots < 3 && term.isDeclaration ? "export " : "";
         keyword = doExport + keyword;
         const lhs = this.translate(term.lhs, scope, { isLhs: true });
         const isMutable = term.type?.translatedType instanceof MutableType;
         let value = term.value
            ? this.makeMutable(this.translate(term.value, scope), isMutable)
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
         } else if (term.value) {
            value = `(${value})`;
         }
         const operator = term.value ? " = " : " ";

         return keyword + lhs + operator + type + value;

         // Literal
      } else if (term instanceof Literal) {
         let rawDisplay = "";
         if (term.type === "String") {
            const strValue = String(term.value).replaceAll(/[\r\n]+/g, "\\n");
            rawDisplay = `"${strValue}"`;
            if (term.is(WHERE_INTERPOLATION_EXPECTED)) {
               rawDisplay = `_interpolation([${rawDisplay}])`;
            }
         } else if (term.type === "Number" || term.type === "Boolean") {
            rawDisplay = `${term.value}`;
         } else {
            rawDisplay = "null";
         }
         if (term.is(IN_TYPE_CONTEXT)) {
            return `_L(${rawDisplay})`;
         } else {
            return rawDisplay;
         }

         // Cast
      } else if (term instanceof Cast) {
         return `_cast(${this.translate(
            term.expression,
            scope
         )}, ${this.translate(term.type, scope)})`;

         // Tuple
      } else if (term instanceof Tuple) {
         if (term.isTypeLevel) {
            return `Tuple${term.expressions.length}(${term.expressions
               .map((el) => this.translate(el, scope))
               .join(",")})`;
         }

         return `Tuple${term.expressions.length}(${term.expressions
            .map(
               (el) => `Type$get(${this.translateType(el.inferredType, scope)})`
            )
            .join(",")})(${term.expressions
            .map((el) => `{_:${this.translate(el, scope)}}`)
            .join(",")})`;

         // Identifier
      } else if (term instanceof Identifier) {
         let value = term.value.replaceAll("@", "$").replaceAll(".", "$");
         if (Object.keys(this.nameReplacers).includes(value)) {
            value = this.nameReplacers[value];
         }
         if (term.isFromSelfClojure && !args.isLhs) {
            const symbol = scope.lookup(term.value);
            if (
               !term.varTypeInInvarPlace &&
               ((symbol.isUsedInClojures && symbol.isSentToConstructors) ||
                  symbol.typeSymbol instanceof MutableType) &&
               symbol.name.startsWith("@")
            ) {
               value = `this._clojure["${this.makeClojureIdent(symbol)}"]._`;
            }
            if (!term.varTypeInInvarPlace && !symbol.isUsedInClojures) {
               // Otherwise accessMutable is added in the wrapper translate() (non-raw)
               value += this.accessMutable;
            }
         }
         if (term.isTypeIdentifier() && term.isInValueContext) {
            value = `Type$get(${value})`;
         }

         return value;

         // RoundValueToValueLambda
      } else if (term instanceof RoundValueToValueLambda) {
         scope = scope.innerScopeOf(term, true);
         if (term.isTypeLambda) {
            return "'CompileTime LambdaType'";
         }
         const params = term.isFirstParamThis()
            ? term.params.slice(1, term.params.length)
            : term.params;
         const includeThisMapping = term.isFirstParamThis()
            ? "const self = this;"
            : "";
         let result = `${term.pure ? "" : "async "}function(${params
            .map((p) => this.translate(p, scope))
            .join(", ")}) {${includeThisMapping};try{\n${this.translate(
            term.block,
            scope,
            {
               returnLast: true,
            }
         )}\n} catch (e) { if (e instanceof Error) { _addStack(e, '${
            scope.name + ":" + scope.position.start
         }'); throw e } else { return e } }}`;

         if (term.inferredType instanceof RoundValueToValueLambdaType) {
            result = `_F([${term.inferredType.params.map(
               (p) => `['${p.name ?? ""}',${this.translateType(p.type, scope)}]`
            )}, ['return', ${this.translateType(
               term.inferredType.returnType,
               scope
            )}]], ${result})`;
         }

         return result;

         // SquareTypeToTypeLambda
      } else if (term instanceof SquareTypeToTypeLambda) {
         //  scope = scope.innerScopeOf(term);
         return `/* [] */(function(){ const _sqSym = Symbol("${
            term.name
         }"); return _Q(_sqSym, (${term.parameterTypes
            .map((t) => this.translate(t, scope.innerScopeOf(term, true)))
            .join(", ")}) => {  const _sqSym_args = [${term.parameterTypes
            .map(
               (t) =>
                  "(" +
                  this.translate(t, scope.innerScopeOf(term, true)) +
                  ")._s"
            )
            .join(",")}]; return ${this.translate(
            term.returnType,
            scope.innerScopeOf(term, true)
         )}}); })()`;

         // IfStatement
      } else if (term instanceof IfStatement) {
         const isTrueBranchIf =
            term.trueBranch instanceof IfStatement ||
            (term.trueBranch instanceof Block &&
               term.trueBranch.statements[0] instanceof IfStatement);
         const innerScope = scope.innerScopeOf(term);
         const trueScope = innerScope.innerScopeOf(term.trueBranch);
         const falseScope =
            term.falseBranch !== undefined
               ? innerScope.innerScopeOf(term.falseBranch)
               : innerScope;
         function wrapWithIIFE(doWrap: boolean, doAsync: boolean, str: string) {
            if (doWrap) {
               return `${
                  doAsync ? "await (async " : "("
               }function(){${str}}).call(this)`;
            } else {
               return str;
            }
         }
         const isTrueBranchSingleExpression =
            term.trueBranch instanceof Block &&
            term.trueBranch.statements.length !== 1;
         const isFalseBranchSingleExpression =
            term.falseBranch instanceof Block &&
            term.falseBranch.statements.length !== 1;
         let trueBranch = wrapWithIIFE(
            true,
            scope.isUnderAsync(),
            this.translate(term.trueBranch, trueScope, {
               returnLast: !isTrueBranchIf,
               normalReturn:
                  scope.isUnderAsync() ||
                  !term.falseBranch?.is(IN_RETURN_BRANCH),
            })
         );
         const isFalseBranchIf =
            term.falseBranch instanceof IfStatement ||
            (term.falseBranch instanceof Block &&
               term.falseBranch.statements[0] instanceof IfStatement);
         let falseBranch = wrapWithIIFE(
            true,
            scope.isUnderAsync(),
            this.translate(term.falseBranch, falseScope, {
               returnLast: !isFalseBranchIf,
               normalReturn: !term.falseBranch?.is(IN_RETURN_BRANCH),
            })
         );
         return `((${this.translate(
            term.condition,
            innerScope
         )}) ? (${trueBranch}) : (${falseBranch})) `;

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
         // Call
      } else if (
         term instanceof Call &&
         term.kind === "CURLY" &&
         !term.isCallingAConstructor
      ) {
         return `_copy(${this.translate(term.callee, scope)}, {${term.args.map(
            ([n, t]) =>
               `${n.replaceAll(".", "$$")}: _var([], () => ${this.translate(
                  t,
                  scope
               )}, true)`
         )}})`;
      } else if (term instanceof Call) {
         if (
            term.callee instanceof Identifier &&
            term.callee.value === "debugThis"
         ) {
            return "debug(this)";
         }
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
         const takesVarargs = term.takesVarargs && !term.bakedInThis;
         let varargType =
            term.args.length > 0
               ? this.translateType(term.args[0][1].inferredType, scope)
               : "";
         let open = takesVarargs ? `(Seq$createProperly(${varargType})([` : "(";
         const close = takesVarargs ? "]))" : ")";
         let openWrapper = "";
         let closeWrapper = "";
         let callee = term.callee;
         if (
            term.callee instanceof Select &&
            !term.callee.isBeingTreatedAsIdentifier
         ) {
            open =
               ".call((typeof _owner !== 'undefined' ? _owner : " +
               this.translate((callee as Select).owner, scope) +
               ")," +
               (takesVarargs ? `Seq$createProperly(${varargType})([` : "");
            if (term.callee.owner instanceof Identifier) {
            } else {
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

               (callee as Select).ownerComponent = term.callee.ownerComponent;
               (callee as Select).ownerComponentAppliedSquareTypes =
                  term.callee.ownerComponentAppliedSquareTypes;
               (callee as Select).isTypeLevel = term.callee.isTypeLevel;
            }
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
         function wrapAwait(call: string) {
            if (
               term instanceof Call &&
               !term.callsPure &&
               [...scope.toPath()].filter((c) => c === ".").length > 1
            ) {
               return `await /* X */ ${call}`;
               //    return `(async function() { const _awObj = ${call}; return _awObj && typeof _awObj.then === 'function' ? await _awObj : _awObj}).call(this)`;
            } else {
               return call;
            }
         }
         let ammortization = term.ammortized
            ? open.startsWith(".")
               ? "?"
               : "?."
            : "";

         return wrapAwait(
            "(" +
               openWrapper +
               this.translate(callee, scope) +
               (term.autoFilledSquareTypeParams
                  ? `.call('Type', ${term.autoFilledSquareTypeParams
                       .inExpectedOrder()
                       .map((type) => this.translateType(type, scope))
                       .join(",")})`
                  : "") +
               ammortization +
               open +
               params
                  .map((arg) => {
                     return !arg ? "undefined" : this.translate(arg[1], scope);
                  })
                  .join(", ") +
               close +
               closeWrapper +
               ")"
         );

         // SquareApply
      } else if (term instanceof Call && term.kind === "SQUARE") {
         return (
            this.translate(term.callee, scope) +
            ".call('Type', " +
            term.args.map((arg) => this.translate(arg[1], scope)).join(", ") +
            ")"
         );

         // TypeDef
      } else if (term instanceof TypeDef) {
         return `_S(typeof _sqSym !== "undefined" ? _Q_share(_sqSym, _sqSym_args) : Symbol("${
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
         return `${term.name}: { type: Type$get(${this.translate(
            term.type,
            scope
         )}), defaultValue: ${this.translate(term.defaultValue, scope)} }`;

         // RefinedDef
      } else if (term instanceof RefinedDef) {
         const termType = term.translatedType as RefinedType;
         return `(() => {
		 const __is_childRef = (_obj) => { return ${
          termType.inputType.name
       }.__is_child(_obj) && (${this.translate(
            term.lambda,
            scope
         )}).call(_obj)};
				const _tpe = (...args) => {const _res = ${
               (term.translatedType as RefinedType).inputType.name
            }(...args); if (__is_childRef(_res)) { return _res } else { print(_res); return undefined }};
				
			_tpe.__is_child = __is_childRef;_tpe._s = Symbol("${
            term.translatedType?.name
         }"); _tpe._isRefinement = true;return _tpe})()`;

         // Optional
      } else if (term instanceof Optional) {
         if (term.expression.isTypeLevel) {
            return this.translate(term.expression, scope);
         } else {
            return `(function(){ const _r = ${this.translate(
               term.expression,
               scope
            )};if(_r === undefined || TinErr_.__is_child(_r)) {throw _r} else {return _r}}).call(this)`;
         }
         // TypeCheck
      } else if (term instanceof TypeCheck) {
         return `${term.negative ? "!" : ""}${this.translate(
            term.type,
            scope
         )}.__is_child(${this.translate(term.term, scope)}) `;
         // Undefined
      } else if (term instanceof Import) {
         function toRelativeImport(fromPath: string, toPath: string): string {
            let relative = pth.relative(pth.dirname(fromPath), toPath);
            if (!relative.startsWith(".")) relative = "./" + relative;
            return relative.replace(/\\/g, "/"); // Ensure POSIX style for imports
         }
         const path = term.path
            // .replaceAll("\\", "\\\\")
            .replaceAll("\\src\\", "\\tin-out\\")
            .replaceAll("\\tests\\", "\\tin-out-tests\\");
         const thisFileNameOut = this.fileName
            // .replaceAll("\\", "\\\\")
            .replaceAll("\\src\\", "\\tin-out\\")
            .replaceAll("\\tests\\", "\\tin-out-tests\\");
         const parts = path.split("tin-out");
         return `import * as module${
            this.moduleNumber
         } from "${toRelativeImport(
            thisFileNameOut,
            parts[1]
         )}.tin.out.mjs";Object.entries(module${this
            .moduleNumber++}).forEach(([key, value]) => {
				globalThis[key] = value;
		  });`;
         // Undefined
      } else if (term instanceof UnaryOperator) {
         if (term.operator === "var") {
            const v = term.invarTypeInVarPlace;
            return `_var([${(term.varDependencies ?? []).map((t) =>
               this.translateRaw(t, scope)
            )}],() => (${this.translate(term.expression, scope)}),${
               v ? "false" : "true"
            })`;
         }
         if (term.operator === "!") {
            return `_N(${this.translate(term.expression, scope)})`;
         }
         if (term.operator === "-") {
            return `-(${this.translate(term.expression, scope)})`;
         }
         return "(? " + term.tag + " " + term.operator + " ?)";
      } else {
         return "(? " + term.tag + " ?)";
      }
   }

   translateType(type: Type | ParamType | undefined, scope: Scope): string {
      if (type instanceof NamedType) {
         return "" + type.name;
      } else if (type instanceof MutableType) {
         return this.translateType(type.type, scope);
      } else if (type instanceof AnyType) {
         return "Anything";
      } else if (type instanceof PrimitiveType) {
         return "" + type.name;
      } else if (type instanceof StructType) {
         return `Type({_:'${
            type.name
         }'}, {_:(obj => typeof obj === 'object' && Reflect.ownKeys(obj).includes(${
            type.name
         }._s))})._and(Struct({_:Seq$createProperly(Type)([
						${type.fields.map((f) => `${this.translateType(f, scope)}`)}
			])}))`;
      } else if (type instanceof ParamType) {
         return `Field({_:"${type.name ?? undefined}"},
			{_:Type$get(${this.translateType(type.type, scope)})},
			(${type.defaultValue ? this.translate(type.defaultValue, scope) : undefined}))
		`;
      } else if (type instanceof IntersectionType) {
         return `${this.translateType(
            type.left,
            scope
         )}._and(${this.translateType(type.right, scope)})`;
      } else if (type instanceof SingletonType) {
         return this.translateType(type.type, scope);
      } else if (type instanceof GenericNamedType) {
         return type.name;
      } else if (type instanceof AppliedGenericType) {
         return `${this.translateType(
            type.callee,
            scope
         )}(${type.parameterTypes.map(
            (p) => `(${this.translateType(p, scope)})`
         )})`;
      }
      //   else if (type instanceof RoundValueToValueLambdaType) {
      //      return `
      // 			Type(["${type.name}"])._and(Lambda(
      // 			Array(Type)([${type.params.map((f) => `${this.translateType(f, scope)},`)}]),
      // 			${this.translateType(type.returnType, scope)}))
      // 		`;
      //   }

      return `{_:'${type?.tag}'}`;
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
            return `_U(${this.translate(term.left, scope)}, ${this.translate(
               term.right,
               scope
            )}${
               term.translatedType?.name
                  ? ",'" + term.translatedType.name + "'"
                  : ""
            })`;
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
            "+string+",
            "+",
            "-",
            "*",
            "**",
            "/",
            "%",
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

      let result =
         this.translate(term.left, scope) +
         " " +
         term.operator +
         " " +
         this.translate(term.right, scope);

      const translator = this;
      function allPlusParts(expr: Term): string[] {
         if (expr instanceof BinaryExpression && expr.operator === "+string+") {
            return [...allPlusParts(expr.left), ...allPlusParts(expr.right)];
         } else if (expr instanceof Literal && expr.type === "String") {
            return [translator.translate(expr, scope)];
         } else {
            return [
               `["${expr.show()}", (${translator.translate(expr, scope)})]`,
            ];
         }

         return [];
      }

      if (term.is(WHERE_INTERPOLATION_EXPECTED)) {
         return `_interpolation([${allPlusParts(term).join(",")}])`;
      }

      if (term.operator === "+string+") {
         return `(${this.translate(term.left, scope)} + ${this.translate(
            term.right,
            scope
         )})`;
      }

      return result;
   }
}
