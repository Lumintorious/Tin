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
   RefinedType,
   PrimitiveType,
   IntersectionType,
} from "./Types";
import { OutputTranslator } from "./compiler";
import { exec } from "node:child_process";

export class JavascriptTranslator implements OutputTranslator {
   extension = "mjs";
   isStdLib: boolean = false;
   constructor(isStdLib: boolean = false) {
      this.isStdLib = isStdLib;
   }

   run(path: string, isTest?: boolean): void {
      exec(
         `cd "tin-out${isTest ? "-tests" : ""}"` + " && bun " + path,
         (_, out, err) => {
            console.log(out);
            if (err) {
               console.log(err);
            }
         }
      );
   }

   accessMutable = "._";
   makeMutable(value: string, condition: boolean) {
      if (condition) {
         return `{_:${value}}`;
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
      if (typeDef.fieldDefs.length === 0) {
         return "() => undefined";
      }

      const parameters =
         "(" +
         typeDef.fieldDefs.map((param, i) => {
            const fieldType = type.fields[i];
            const isPrimitive = fieldType instanceof PrimitiveType;
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

      if (term instanceof Term) {
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
            result = `{_:(${result}),_cn:("${term.capturedName}")}`;
         } else if (
            term.invarTypeInVarPlace &&
            !(term instanceof AppliedKeyword && term.keyword === "return")
         ) {
            result = `{_:${result}}`;
         } else if (term.varTypeInInvarPlace) {
            result = "(" + result + ")" + this.accessMutable;
         }

         if (term.clojure) {
            result = `_makeClojure({${term.clojure
               .map((s) => s.name)
               .join(",")}}, ${result})`;
         }
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
         scope = scope.innerScopeOf(term);
         const isTerm = last instanceof Term;
         const shouldReturn =
            isTerm &&
            args &&
            args.returnLast &&
            !(last instanceof WhileLoop || last instanceof AppliedKeyword);
         const forceReturn = args.forceReturn;
         let result = [
            ...term.statements.map((st) => this.translate(st, scope)),
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
         if (
            !term.ownerComponent &&
            !term.unionOwnerComponents &&
            !term.isDeclaration
         ) {
            console.error(term);
            throw new Error(
               "Attempted select on object without components. Field = " +
                  term.field
            );
         }
         let ownerName = this.translate(term.owner, scope);
         let selectionBase = "";
         if (term.isDeclaration) {
            selectionBase = `${term
               .nameAsSelectOfIdentifiers()
               ?.replaceAll(".", "$")}`;
            ownerName = "";
         } else if (term.ownerComponent) {
            const symbolSplice = term.ownerComponentAppliedSquareTypes
               ? `_Q_share(${
                    term.ownerComponent
                 }._s, [${term.ownerComponentAppliedSquareTypes
                    .map((s) => s + "._s")
                    .join(",")}] )`
               : `${term.ownerComponent}._s`;
            selectionBase = `[${symbolSplice}]${operator}${term.field}`;
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
         }
         if (!term.varTypeInInvarPlace && !term.isDeclaration) {
            selectionBase += this.accessMutable;
         }
         return `${ownerName}${selectionBase}`;

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
         )}\n} catch(e) { if(e instanceof Error || typeof e === 'object' && TinErr_._s in e ) {throw e} else { return e} } })`;

         // Change
      } else if (term instanceof Change) {
         const termValueType = term.value.inferredType;
         const start = termValueType instanceof MutableType ? "(" : "";
         const ifTermValueMutable =
            termValueType instanceof MutableType
               ? ")" + this.accessMutable
               : "";
         const isNotSelect = !(term.lhs instanceof Select);
         return `(${this.translate(term.lhs, scope)})${
            isNotSelect ? this.accessMutable : ""
         } = ${start}${this.translate(term.value, scope)}${ifTermValueMutable}`;

         // Assignment
      } else if (term instanceof Assignment) {
         if (
            (term.value instanceof Literal &&
               term.value.value === "" &&
               term.value.type === "Anything") ||
            (term.lhs instanceof Identifier && term.lhs.value === "Array")
         ) {
            return "";
         }
         let keyword = term.isDeclaration ? "var " : "";
         const scopeDots = [...(scope.toPath().matchAll(/\./g) || [])].length;
         const doExport = scopeDots < 3 && term.isDeclaration ? "export " : "";
         keyword = doExport + keyword;
         const lhs = this.translate(term.lhs, scope);
         const isMutable = term.type?.translatedType instanceof MutableType;
         const value = term.value
            ? " = " +
              this.makeMutable(this.translate(term.value, scope), isMutable)
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

         return `Tuple${term.expressions.length}({}, {}, {})(${term.expressions
            .map((el) => `{_:${this.translate(el, scope)}}`)
            .join(",")})`;

         // Identifier
      } else if (term instanceof Identifier) {
         const replacers: { [_: string]: string } = {
            // Type: "Type$",
            this: "this_",
            // self: "this",
            Error: "TinErr_",
            Map: "Map_",
         };
         let value = term.value.replaceAll("@", "$").replaceAll(".", "$");
         if (Object.keys(replacers).includes(value)) {
            value = replacers[value];
         }
         if (term.isTypeIdentifier() && term.isInValueContext) {
            value = `Type$get(${value})`;
         }
         if (term.isFromSelfClojure) {
            value = `this._clojure.${value}`;
            // Otherwise accessMutable is added in the wrapper translate() (non-raw)
            if (!term.varTypeInInvarPlace) {
               value += this.accessMutable;
            }
         }

         return value;

         // RoundValueToValueLambda
      } else if (term instanceof RoundValueToValueLambda) {
         scope = scope.innerScopeOf(term, true);
         const params = term.isFirstParamThis()
            ? term.params.slice(1, term.params.length)
            : term.params;
         const includeThisMapping = term.isFirstParamThis()
            ? "const self = this;"
            : "";
         return `${term.pure ? "" : "async "}function(${params
            .map((p) => this.translate(p, scope))
            .join(", ")}) {${includeThisMapping};try{\n${this.translate(
            term.block,
            scope,
            {
               returnLast: true,
            }
         )}\n} catch (e) { if (e instanceof Error || typeof e === 'object' && TinErr_._s in e ) { _addStack(e, '${
            scope.name + ":" + scope.position.start
         }'); throw e } else { return e } }}`;

         // SquareTypeToTypeLambda
      } else if (term instanceof SquareTypeToTypeLambda) {
         scope = scope.innerScopeOf(term);
         return `/* [] */(function(){ const _sqSym = Symbol("${
            term.name
         }"); return _Q(_sqSym, (${term.parameterTypes
            .map((t) => this.translate(t, scope.innerScopeOf(term, true)))
            .join(", ")}) => {  const _sqSym_args = [${term.parameterTypes
            .map(
               (t) => this.translate(t, scope.innerScopeOf(term, true)) + "._s"
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
         let trueBranch = `(function(){${this.translate(
            term.trueBranch,
            trueScope,
            {
               returnLast: !isTrueBranchIf,
               normalReturn: true,
            }
         )}}).call(this)`;
         const isFalseBranchIf =
            term.falseBranch instanceof IfStatement ||
            (term.falseBranch instanceof Block &&
               term.falseBranch.statements[0] instanceof IfStatement);
         let falseBranch = `(function(){${this.translate(
            term.falseBranch,
            falseScope,
            {
               returnLast: !isFalseBranchIf,
               normalReturn: true,
            }
         )}}).call(this)`;
         return `((${this.translate(
            term.condition,
            innerScope
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
         // Call
      } else if (
         term instanceof Call &&
         term.kind === "CURLY" &&
         !term.isCallingAConstructor
      ) {
         return `_copy(${this.translate(term.callee, scope)}, {${term.args.map(
            ([n, t]) => `${n}: ${this.translate(t, scope)},`
         )}})`;
      } else if (term instanceof Call) {
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
         let open = takesVarargs ? "(Array(0)([" : "(";
         const close = takesVarargs ? "]))" : ")";
         let openWrapper = "";
         let closeWrapper = "";
         let callee = term.callee;
         if (
            term.callee instanceof Select &&
            !term.callee.isBeingTreatedAsIdentifier
         ) {
            open =
               ".call(" +
               this.translate((callee as Select).owner, scope) +
               "," +
               (takesVarargs ? "Array(0)([" : "");
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
               [...scope.toPath()].filter((c) => c === ".").length > 4
            ) {
               return `await ${call}`;
               //    return `(async function() { const _awObj = ${call}; return _awObj && typeof _awObj.then === 'function' ? await _awObj : _awObj}).call(this)`;
            } else {
               return call;
            }
         }

         return wrapAwait(
            "(" +
               openWrapper +
               this.translate(callee, scope) +
               (term.autoFilledSquareTypeParams
                  ? `.call('Type', ${term.autoFilledSquareTypeParams.order
                       .map(([name, type]) => this.translateType(type, scope))
                       .join(",")})`
                  : "") +
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
         return `${term.name}: { type: ${this.translate(
            term.type,
            scope
         )}, defaultValue: ${this.translate(term.defaultValue, scope)} }`;

         // RefinedDef
      } else if (term instanceof RefinedDef) {
         const termType = term.translatedType as RefinedType;
         return `(() => {
				const _tpe = {__is_child: (_obj) => { return ${
               termType.inputType.name
            }.__is_child(_obj) && (${this.translate(
            term.lambda,
            scope
         )}).call(_obj)}}; _tpe._s = Symbol("${
            term.translatedType?.name
         }"); return _tpe})()`;

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
         return `import * as module${this.moduleNumber} from "file://${term.path
            .replaceAll("\\", "\\\\")
            .replaceAll("\\src\\", "\\tin-out\\")
            .replaceAll(
               "\\tests\\",
               "\\tin-out-tests\\"
            )}.tin.out.mjs";Object.entries(module${this
            .moduleNumber++}).forEach(([key, value]) => {
				globalThis[key] = value;
		  });`;
         // Undefined
      } else if (term instanceof UnaryOperator) {
         if (term.operator === "var") {
            const v = term.invarTypeInVarPlace;
            return `_var(${this.translate(term.expression, scope)},${
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
      }
      if (type instanceof MutableType) {
         return this.translateType(type.type, scope);
      } else if (type instanceof PrimitiveType) {
         return "" + type.name;
      } else if (type instanceof StructType) {
         return `Type({_:'${
            type.name
         }'}, {_:(obj => typeof obj === 'object' && Reflect.ownKeys(obj).includes(${
            type.name
         }._s))})._and(Struct({_:Array(0)([
						${type.fields.map((f) => `${this.translateType(f, scope)}`)}
			])}))`;
      } else if (type instanceof ParamType) {
         return `Field({_:"${type.name ?? undefined}"},
					{_:Type$get(${this.translateType(type.type, scope)})},
					() => { return (${
                  type.defaultValue
                     ? this.translate(type.defaultValue, scope)
                     : undefined
               })})
		`;
      } else if (type instanceof IntersectionType) {
         return `${this.translateType(
            type.left,
            scope
         )}._and(${this.translateType(type.right, scope)})`;
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
            return this.translate(
               new Call("ROUND", new Identifier("_U"), [
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
