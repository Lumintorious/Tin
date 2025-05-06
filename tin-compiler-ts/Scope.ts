import { CodePoint, TokenPos } from "./Lexer";
import {
   Assignment,
   AstNode,
   BinaryExpression,
   Call,
   Identifier,
   Select,
   Term,
} from "./Parser";
import { TypeBuilder } from "./TypeBuilder";
import { TypeChecker, TypeErrorList } from "./TypeChecker";
import { TypeInferencer } from "./TypeInferencer";
import { TypeTranslator } from "./TypeTranslator";
import { type } from "os";
import { LiteralType } from "./Types";
import {
   Any,
   AppliedGenericType,
   GenericNamedType,
   IntersectionType,
   MutableType,
   NamedType,
   OptionalType,
   ParamType,
   RefinedType,
   RoundValueToValueLambdaType,
   SquareTypeToTypeLambdaType,
   SquareTypeToValueLambdaType,
   StructType,
   Type,
   UncheckedType,
   UnionType,
} from "./Types";

export class Symbol {
   name: string;
   typeSymbol: Type;
   ast?: Term;
   iteration: Iteration = "DECLARATION";
   position?: TokenPos;
   index?: number;
   parentComponent?: Type; // If a field on type ABC, then parentComponent is ABC
   shadowing?: Symbol;
   isMutable: boolean = false;
   isLink: boolean = false;
   isPrivate: boolean = false;
   constructor(name: string, typeSymbol: Type, ast?: Term) {
      this.name = name;
      this.typeSymbol = typeSymbol;
      this.ast = ast;
   }

   mutable(mutable: boolean) {
      this.isMutable = mutable;
      return this;
   }

   located(start?: TokenPos, end?: TokenPos) {
      if (start && end) {
         this.position = new TokenPos(start.start, end.end);
      } else if (start) {
         this.position = start;
      }
      return this;
   }

   // Used to change all fields so the reference doesn't change
   // Happens only when filling in an UncheckedType symbol
   rewriteFrom(template: Symbol) {
      // if (!(template.typeSymbol instanceof UncheckedType)) {
      //    throw new Error(
      //       "Attempted to rewrite a checked type symbol. Only unchecked type symbols from run 0 can be rewritten in run 1."
      //    );
      // }
      this.name = template.name;
      this.typeSymbol = template.typeSymbol;
      this.ast = template.ast;
      this.iteration = template.iteration;
      // this.shadowing = this.shadowing || template.shadowing;
      this.position = template.position;
      this.index = template.index;
   }
}

export type Iteration = "DECLARATION" | "RESOLUTION";

export class Scope {
   name: string;
   parent?: Scope;
   symbols: Map<string, Symbol> = new Map();
   typeSymbols: Map<string, Symbol> = new Map();
   symbolsByAst: Map<AstNode, Symbol> = new Map();
   typeSymbolsByAst: Map<AstNode, Symbol> = new Map();
   childrenByAst: Map<Number, Scope> = new Map();
   currentIndex: number = 0;
   iteration: Iteration = "DECLARATION";
   static currentKey = 0;
   static currentId = 0;
   id: number = Scope.currentId++;
   position: TokenPos = new TokenPos(
      new CodePoint(0, 0, 0),
      new CodePoint(0, 0, 0)
   );
   constructor(name: string, parent?: Scope) {
      this.name = name;
      this.parent = parent;
      if (parent) {
         this.iteration = parent.iteration;
      }
   }

   named(name: string) {
      this.name = name;
      return this;
   }

   checkNoUncheckedTypesLeft() {
      let uncheckedSymbols: [string, Symbol][] = [];
      for (const symbol of this.symbols.values()) {
         if (symbol.typeSymbol instanceof UncheckedType) {
            uncheckedSymbols.push([this.toPath(), symbol]);
         }
      }
      for (const child of this.childrenByAst.values()) {
         uncheckedSymbols = [
            ...uncheckedSymbols,
            ...child.checkNoUncheckedTypesLeft(),
         ];
      }
      return uncheckedSymbols;
   }

   absorbAllFrom(scope: Scope) {
      scope.symbols.forEach((v, k) => this.symbols.set(k, v));
      scope.typeSymbols.forEach((v, k) => this.typeSymbols.set(k, v));
      scope.symbolsByAst.forEach((v, k) => this.symbolsByAst.set(k, v));
      scope.typeSymbolsByAst.forEach((v, k) => this.typeSymbolsByAst.set(k, v));
      scope.childrenByAst.forEach((v, k) => this.childrenByAst.set(k, v));
      this.currentIndex = this.currentIndex + scope.currentIndex;
   }

   setIteration(iteration: Iteration) {
      this.iteration = iteration;
      this.childrenByAst.forEach((v) => {
         v.setIteration(iteration);
      });
   }

   innerScopeOf(astNode: AstNode, canCreate: boolean = false): Scope {
      const ast = astNode as any;
      let child = this.childrenByAst.get(ast.id);
      if (!child && !canCreate) {
         try {
            child = this.parent?.innerScopeOf(astNode);
         } catch (e) {}
      }
      if (!child && !canCreate) {
         throw new Error(
            "Could not find child scope " + this.getTree() + " - " + astNode.tag
            //    " -- " +
            //    astNode.tag +
            //    "(" +
            //    astNode.id +
            //    ")"
         );
      }
      if (child) {
         return child;
      } else {
         const child = new Scope(astNode.show(), this);
         child.setIteration(this.iteration);
         if (astNode.position) {
            child.position = astNode.position;
         }
         this.childrenByAst.set(ast.id, child);
         return child;
      }
   }

   toString() {
      return "Scope { " + this.name + " }";
   }

   toPath() {
      let str = "";
      let now: Scope | undefined = this;
      while (now !== undefined) {
         str = now.name + "." + str;
         now = now.parent;
      }
      return str.substring(0, str.length - 1);
   }

   getTree() {
      let str = "";
      let now: Scope | undefined = this;
      while (now !== undefined) {
         str = now.name + `(${JSON.stringify(now.position)})` + "\n" + str;
         now = now.parent;
      }
      return str.substring(0, str.length - 1);
   }

   mapAst(astNode: AstNode, kind: "TERM" | "TYPE", symbol: Symbol) {
      if (kind === "TERM") {
         this.symbolsByAst.set(astNode, symbol);
      } else {
         this.typeSymbolsByAst.set(astNode, symbol);
      }
   }

   // Define a new symbol in the current scope
   declare(symbol: Symbol, redeclare: boolean = false) {
      const name = symbol.name;
      console.log(
         `# \x1b[36m${name.padStart(
            10,
            " "
         )}\x1b[37m: \x1b[33m${symbol.typeSymbol
            .toString()
            .padEnd(25, " ")} \x1b[30m# ${
            this.toPath() + " - " + this.iteration + " - " + symbol.isLink // + " - " + new Error().stack
         }\x1b[0m`
      );
      if (this.symbols.has(name)) {
         const existingSymbol = this.symbols.get(name);
         if (existingSymbol?.typeSymbol instanceof UncheckedType) {
            existingSymbol.rewriteFrom(symbol);
            return;
         } else if (
            existingSymbol &&
            existingSymbol.iteration == this.iteration
         ) {
            if (!redeclare) {
               throw new Error(
                  `Symbol ${name} is already declared in ` + this.toPath()
               );
            }
         } else {
            symbol.iteration = this.iteration;
         }
      }
      symbol.iteration = this.iteration;
      if (!symbol.index) {
         symbol.index = this.currentIndex++;
      }
      this.symbols.set(name, symbol);
      if (symbol.ast) {
         this.symbolsByAst.set(symbol.ast, symbol);
         if (symbol.ast instanceof Assignment) {
            symbol.ast.symbol = symbol;
         }
      }
   }

   remove(name: string) {
      if (this.symbols.has(name)) {
         this.symbols.delete(name);
      } else {
         this.parent?.remove(name);
      }
   }

   declareType(symbol: Symbol) {
      const name = symbol.name;
      const typeSymbol = symbol.typeSymbol;
      typeSymbol.name = name;
      if (this.typeSymbols.has(name)) {
         const existingSymbol = this.typeSymbols.get(name);
         if (
            existingSymbol &&
            existingSymbol.iteration == this.iteration &&
            !(existingSymbol.typeSymbol instanceof UncheckedType)
         ) {
            throw new Error(`Symbol ${name} is already declared.`);
         } else {
            symbol.iteration = this.iteration;
         }
      }
      console.log(
         "# " +
            "\x1b[36m" +
            name.padStart(10, " ") +
            "\x1b[37m: \x1b[33m" +
            (typeSymbol.toString() + " .. " + typeSymbol.tag).padEnd(25, " ") +
            " \x1b[30m#Type# " +
            this.toPath() +
            "\x1b[0m"
      );
      symbol.iteration = this.iteration;
      const constructor = typeSymbol.buildConstructor();
      if (constructor) {
         this.declare(new Symbol(name, constructor));
         this.remove(name);
      }

      typeSymbol.name = name;
      if (!typeSymbol.index) {
         typeSymbol.index = this.currentIndex++;
      }
      this.typeSymbols.set(name, symbol);
   }

   // Lookup a symbol, check parent scope if not found
   lookup(name: string, scopeName: string = ""): Symbol {
      if (this.symbols.has(name)) {
         return this.symbols.get(name) as Symbol;
      } else if (this.parent) {
         return this.parent.lookup(name, this.name + "." + scopeName);
      }
      throw new Error(
         `Symbol ${name} not found. ${[...this.symbols.keys()]}; Scope = ` +
            this.name +
            "." +
            scopeName
      );
   }

   getAllSymbols() {
      const symbols = [...this.symbols];
      if (this.parent) {
         symbols.push(...this.parent.getAllSymbols());
      }
      return symbols;
   }

   lookupExtension(name: string, ownerType: Type, scopeName = ""): Symbol {
      let foundSymbol: Symbol | undefined;
      let trueOwnerType =
         ownerType instanceof MutableType ? ownerType.type : ownerType;
      for (let [symName, sym] of this.getAllSymbols()) {
         if (symName.includes(".")) {
            const parts = symName.split(".");
            symName = parts[parts.length - 1];
            if (parts[0] !== trueOwnerType.name) {
               continue;
            }
         }
         if (symName === name) {
            foundSymbol = sym;
            break;
         }
      }
      if (foundSymbol !== undefined) {
         return foundSymbol;
      }
      throw new Error(
         `Symbol ${name} not found. ${[...this.symbols.keys()]}; Scope = ` +
            this.name +
            "." +
            scopeName
      );
   }

   hasSymbol(name: string, stopAtScope?: Scope): boolean {
      return (
         this.symbols.has(name) ||
         (this.parent?.id === stopAtScope?.id
            ? false
            : this.parent?.hasSymbol(name, stopAtScope) ?? false)
      );
   }

   hasTypeSymbol(name: string): boolean {
      return (
         this.typeSymbols.has(name) ||
         (this.parent?.hasTypeSymbol(name) ?? false)
      );
   }

   lookupByAst(ast: AstNode, scopeName: string = ""): Symbol {
      if (this.symbolsByAst.has(ast)) {
         return this.symbolsByAst.get(ast) as any;
      } else if (this.parent) {
         return this.parent.lookupByAst(ast, this.name + "." + scopeName);
      }
      throw new Error(
         `Symbol from AST not found. ${[...this.symbols.keys()]}; Scope = ` +
            this.name +
            "." +
            scopeName
      );
   }

   lookupType(name: string, scopeName: string = ""): Symbol {
      if (this.typeSymbols.has(name)) {
         return this.typeSymbols.get(name) as any;
      } else if (this.parent) {
         return this.parent.lookupType(
            name,
            this.name + "/" + this.id + "." + scopeName
         );
      }
      throw new Error(
         `Type Symbol ${name} not found. Scope = ` +
            this.name +
            "." +
            scopeName +
            ". Iteration = " +
            this.iteration
      );
   }

   lookupTypeByAst(ast: AstNode): Type {
      if (this.typeSymbolsByAst.has(ast)) {
         return this.typeSymbolsByAst.get(ast) as any;
      } else if (this.parent) {
         return this.parent.lookupTypeByAst(ast);
      }
      throw new Error(
         `Type Symbol from AST not found. ${[
            ...this.symbols.keys(),
         ]}; Scope = ` + this.name
      );
   }

   resolveNamedType(type: Type): Type {
      if (type instanceof NamedType) {
         const realType = this.lookupType(type.name).typeSymbol;
         realType.name = type.name;
         return realType;
      } else {
         return type;
      }
   }

   resolveAppliedGenericTypes(type: Type) {
      if (!(type instanceof AppliedGenericType)) {
         return type;
      }
      let typeCallee = this.resolveNamedType(type.callee);
      if (typeCallee instanceof UncheckedType) {
         return new UncheckedType();
      }
      if (typeCallee instanceof GenericNamedType && typeCallee.extendedType) {
         typeCallee = this.resolveNamedType(typeCallee.extendedType);
         typeCallee = this.resolveAppliedGenericTypes(typeCallee);
      }
      if (
         !(typeCallee instanceof SquareTypeToTypeLambdaType) &&
         !(typeCallee instanceof SquareTypeToValueLambdaType)
      ) {
         throw new Error(
            "Attempted to apply generic parameters to non type lambda. Was " +
               typeCallee.toString() +
               " - " +
               typeCallee.tag
         );
      }
      const calledArgs = type.parameterTypes;
      const expectedArgs = typeCallee.paramTypes;
      const mappedParams = GenericTypeMap.fromPairs(expectedArgs, calledArgs);
      type.resolved = this.resolveGenericTypes(
         typeCallee.returnType,
         mappedParams
      );
      if (typeCallee.returnType.name && !type.resolved.name) {
         type.resolved.name = typeCallee.returnType.name;
      } else if (typeCallee.name && !type.resolved.name) {
         type.resolved.name = typeCallee.name;
      }
      return type.resolved;
   }

   resolveFully(type: Type): Type {
      if (type instanceof NamedType) {
         return this.resolveFully(this.resolveNamedType(type));
      } else if (type instanceof AppliedGenericType) {
         return this.resolveFully(this.resolveAppliedGenericTypes(type));
      } else {
         return type;
      }
   }

   resolveGenericTypes(type: Type, paramMap: GenericTypeMap): Type {
      switch (type.tag) {
         case "NamedType":
            const typeName = type.name ? paramMap.get(type.name) : undefined;
            if (typeName) {
               const param = typeName;
               if (param instanceof Identifier) {
                  return new NamedType(param.value);
               } else {
                  return param;
               }
            } else {
               return type;
            }
         case "GenericNamedType":
            const typeNameG = type.name ? paramMap.get(type.name) : undefined;
            if (typeNameG) {
               if (typeNameG instanceof Identifier) {
                  return new NamedType(typeNameG.value);
               } else {
                  return typeNameG;
               }
            } else {
               return type;
            }
         case "AppliedGenericType":
            if (type instanceof AppliedGenericType) {
               const callee = this.resolveGenericTypes(type.callee, paramMap);
               const params = type.parameterTypes.map((p) =>
                  this.resolveGenericTypes(p, paramMap)
               );
               return new AppliedGenericType(callee, params);
            }
            return type;
         case "RoundValueToValueLambdaType":
            const lambdaType = type as RoundValueToValueLambdaType;
            const resolvedParams = lambdaType.params.map((pt) => {
               return new ParamType(
                  this.resolveGenericTypes(pt.type, paramMap),
                  pt.name,
                  pt.defaultValue
               );
            });
            const returnType = this.resolveGenericTypes(
               lambdaType.returnType,
               paramMap
            );
            const result = new RoundValueToValueLambdaType(
               resolvedParams,
               returnType,
               false,
               lambdaType.pure
            );
            result.isConstructor = lambdaType.isConstructor;
            result.isFirstParamThis = lambdaType.isFirstParamThis;
            result.isForwardReferenceable = lambdaType.isForwardReferenceable;
            return result;
         case "StructType":
            if (!(type instanceof StructType)) {
               throw new Error("What the hell??");
            }
            const mappedFields = type.fields.map((f) => {
               return new ParamType(
                  this.resolveGenericTypes(f.type, paramMap),
                  f.name,
                  f.defaultValue
               );
            });
            const structResult = new StructType(type.name, mappedFields);
            console.log(structResult.toString());
            structResult.squareParamsApplied = paramMap.order.map((p) =>
               p[1] instanceof LiteralType ? p[1].type : p[1]
            );
            return structResult;
         case "OptionalType":
            const optionalType = type as OptionalType;
            const newInnerType = this.resolveGenericTypes(
               optionalType.type,
               paramMap
            );
            return new OptionalType(newInnerType);
         case "LiteralType":
            return type;
         case "UnionType":
            const uType = type as UnionType;
            return new UnionType(
               this.resolveGenericTypes(uType.left, paramMap),
               this.resolveGenericTypes(uType.right, paramMap)
            );
         case "IntersectionType":
            const iType = type as IntersectionType;
            return new IntersectionType(
               this.resolveGenericTypes(iType.left, paramMap),
               this.resolveGenericTypes(iType.right, paramMap)
            );
         case "Anything":
            return Any;
         case "Unchecked":
            return type;
         case "This":
            return type;
         case "MutableType":
            return new MutableType(
               this.resolveGenericTypes((type as MutableType).type, paramMap)
            );
         case "PrimitiveType":
            return type;
         case "Nothing":
            return type;
         case "Never":
            return type;
         case "Any":
            return type;
         case "RefinedType":
            return new RefinedType(
               this.resolveGenericTypes(
                  (type as RefinedType).inputType,
                  paramMap
               )
            );
         case "SquareTypeToValueLambdaType":
            return type;
         default:
            throw new Error(
               "Can't handle type " +
                  type.toString() +
                  " - " +
                  type.tag +
                  " when resolving generic named types."
            );
      }
   }
}

export class GenericTypeMap {
   static empty() {
      return new GenericTypeMap();
   }

   static with(key: string, value: Type) {
      const result = new GenericTypeMap();
      result.set(key, value);
      return result;
   }

   static fromPairs(expectedTypes: Type[], gottenTypes: Type[]) {
      const map = new GenericTypeMap();
      for (
         let i = 0;
         i < Math.min(expectedTypes.length, gottenTypes.length);
         i++
      ) {
         if (expectedTypes[i].name) {
            map.set(expectedTypes[i].name as any, gottenTypes[i]);
         }
      }
      return map;
   }

   map: Map<string, Type> = new Map();
   order: [string, Type][] = [];

   set(key: string, value: Type) {
      this.map.set(key, value);
      this.order.push([key, value]);
   }

   get(key: string) {
      return this.map.get(key);
   }

   at(i: number) {
      return this.order[i];
   }

   absorb(map: GenericTypeMap) {
      this.map = new Map([...this.map, ...map.map]);
      this.order = [...this.order, ...map.order];
   }

   toString() {
      return [...this.map.entries()].map(([k, v]) => `${k}: ${v}`);
   }
}

export function walkTerms(
   root: AstNode,
   scope: Scope,
   fn: (node: AstNode, scope: Scope) => void
) {
   fn(root, scope);
   if (root instanceof BinaryExpression) {
      walkTerms(root.left, scope, fn);
      walkTerms(root.right, scope, fn);
   } else if (root instanceof Call) {
      walkTerms(root.callee, scope, fn);
      root.args.forEach((arg) => walkTerms(arg[1], scope, fn));
   } else if (root instanceof Select) {
      walkTerms(root.owner, scope, fn);
   }
}

export type RecursiveResolutionOptions = {
   firstPartOfIntersection?: Type;
   typeExpectedInPlace?: Type;
   typeExpectedAsOwner?: Type;
   assignedName?: string;
   isTypeLevel?: boolean;
   isWithinCopyStructure?: boolean;
   expectsBroadenedType?: boolean;
};

export class CompilerFlags {
   checkImpurity = false;
}

export class TypePhaseContext {
   fileName: string;
   languageScope: Scope;
   fileScope: Scope;
   builder: TypeBuilder;
   inferencer: TypeInferencer;
   translator: TypeTranslator;
   checker: TypeChecker;
   errors: TypeErrorList;
   flags: CompilerFlags;
   run: number;
   constructor(
      fileName: string,
      ast: AstNode,
      existingFileScopes: Scope[] = [],
      languageScope?: Scope
   ) {
      this.fileName = fileName;
      const receivedLanguageScope = !!languageScope;
      this.languageScope = languageScope ?? new Scope("lang");
      this.fileScope = new Scope("file", this.languageScope);
      this.builder = new TypeBuilder(this);
      this.inferencer = new TypeInferencer(this);
      this.translator = new TypeTranslator(this);
      this.checker = new TypeChecker(this);
      this.errors = new TypeErrorList(this);
      this.flags = new CompilerFlags();
      this.run = 0;
      existingFileScopes.forEach((s) => {
         this.fileScope.absorbAllFrom(s);
      });
      if (!receivedLanguageScope) {
      }

      this.languageScope.setIteration("DECLARATION");
      this.fileScope.setIteration("DECLARATION"); // Recursive
      this.builder.build(ast, this.fileScope);
      this.run = 1;
      this.languageScope.setIteration("RESOLUTION");
      this.fileScope.setIteration("RESOLUTION"); // Recursive
      this.builder.build(ast, this.fileScope);
      return this;
   }
}
