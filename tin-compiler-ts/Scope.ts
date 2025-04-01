import { TokenPos } from "./Lexer";
import {
   Assignment,
   AstNode,
   Block,
   Identifier,
   RoundValueToValueLambda,
   Term,
} from "./Parser";
import { TypeBuilder } from "./TypeBuilder";
import { TypeChecker, TypeErrorList } from "./TypeChecker";
import { TypeInferencer } from "./TypeInferencer";
import { TypeTranslator } from "./TypeTranslator";
import {
   AnyType,
   AppliedGenericType,
   BinaryOpType,
   GenericNamedType,
   MutableType,
   NamedType,
   OptionalType,
   ParamType,
   RoundValueToValueLambdaType,
   SquareTypeToTypeLambdaType,
   SquareTypeToValueLambdaType,
   StructType,
   Type,
   UncheckedType,
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
   constructor(name: string, parent?: Scope) {
      this.name = name;
      this.parent = parent;
      if (parent) {
         this.iteration = parent.iteration;
      }
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
            "Could not find child scope " +
               this.toPath() +
               " -- " +
               astNode.tag +
               "(" +
               astNode.id +
               ")"
         );
      }
      if (child) {
         return child;
      } else {
         const child = new Scope(`${astNode.tag}(n${astNode.id}, `, this);
         child.setIteration(this.iteration);
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
         str = now.name + "s" + this.id + ")." + str;
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
            this.toPath() + " - " + this.iteration
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
               throw new Error(`Symbol ${name} is already declared.`);
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
            " \x1b[30m# " +
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
         return this.parent.lookup(
            name,
            this.name + "s" + this.id + ")." + scopeName
         );
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
      const typeCallee = this.resolveNamedType(type.callee);
      if (typeCallee instanceof UncheckedType) {
         return new UncheckedType();
      }
      if (!(typeCallee instanceof SquareTypeToTypeLambdaType)) {
         throw new Error(
            "Attempted to apply generic parameters to non type lambda. Was " +
               typeCallee.toString()
         );
      }
      const calledArgs = type.parameterTypes;
      const expectedArgs = typeCallee.paramTypes;
      const params: { [_: string]: Type } = {};
      for (let i = 0; i < calledArgs.length; i++) {
         params[expectedArgs[i].name] = calledArgs[i];
      }
      type.resolved = this.resolveGenericTypes(typeCallee.returnType, params);
      if (typeCallee.returnType.name && !type.resolved.name) {
         type.resolved.name = typeCallee.returnType.name;
      } else if (typeCallee.name && !type.resolved.name) {
         type.resolved.name = typeCallee.name;
      }
      return type.resolved;
   }

   resolveGenericTypes(
      type: Type,
      parameters: { [genericName: string]: Type } = {}
   ): Type {
      for (let param in parameters) {
         if (!parameters[param]) {
            throw new Error("Undefined type at " + param);
         }
      }
      switch (type.tag) {
         case "NamedType":
            if (type.name && Object.keys(parameters).includes(type.name)) {
               const param = parameters[type.name];
               if (param instanceof Identifier) {
                  return new NamedType(param.value);
               } else {
                  return param;
               }
            } else {
               return type;
            }
         case "GenericNamedType":
            if (type.name && Object.keys(parameters).includes(type.name)) {
               const param = parameters[type.name];
               if (param instanceof Identifier) {
                  return new NamedType(param.value);
               } else {
                  return param;
               }
            } else {
               return type;
            }
         case "AppliedGenericType":
            if (type instanceof AppliedGenericType) {
               const callee = this.resolveGenericTypes(type.callee, parameters);
               const params = type.parameterTypes.map((p) =>
                  this.resolveGenericTypes(p, parameters)
               );
               return new AppliedGenericType(callee, params);
            }
            return type;
         case "RoundValueToValueLambdaType":
            const lambdaType = type as RoundValueToValueLambdaType;
            const resolvedParams = lambdaType.params.map((pt) => {
               return new ParamType(
                  this.resolveGenericTypes(pt.type, parameters),
                  pt.name,
                  pt.defaultValue
               );
            });
            const returnType = this.resolveGenericTypes(
               lambdaType.returnType,
               parameters
            );
            const result = new RoundValueToValueLambdaType(
               resolvedParams,
               returnType,
               false,
               lambdaType.pure
            );
            result.isFirstParamThis = lambdaType.isFirstParamThis;
            result.isForwardReferenceable = lambdaType.isForwardReferenceable;
            return result;
         case "StructType":
            if (!(type instanceof StructType)) {
               throw new Error("What the hell??");
            }
            const mappedFields = type.fields.map((f) => {
               return new ParamType(
                  this.resolveGenericTypes(f.type, parameters),
                  f.name,
                  f.defaultValue
               );
            });
            return new StructType(type.name, mappedFields);
         case "OptionalType":
            const optionalType = type as OptionalType;
            const newInnerType = this.resolveGenericTypes(
               optionalType.type,
               parameters
            );
            return new OptionalType(newInnerType);
         case "LiteralType":
            return type;
         case "BinaryOpType":
            const bType = type as BinaryOpType;
            return new BinaryOpType(
               this.resolveGenericTypes(bType.left, parameters),
               bType.operator,
               this.resolveGenericTypes(bType.right, parameters)
            );
         case "Anything":
            return AnyType;
         case "Unchecked":
            return type;
         case "This":
            return type;
         case "MutableType":
            return new MutableType(
               this.resolveGenericTypes((type as MutableType).type)
            );
         default:
            throw new Error(
               "Can't handle type " +
                  type.toString() +
                  " when resolving generic named types."
            );
      }
   }

   resolveFully(type: Type): Type {
      if (type instanceof NamedType) {
         if (type.isPrimitive()) {
            return type;
         } else {
            return this.resolveFully(this.resolveNamedType(type));
         }
      } else if (type instanceof AppliedGenericType) {
         return this.resolveFully(this.resolveAppliedGenericTypes(type));
      } else {
         return type;
      }
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
      existingFileScopes: Scope[] = []
   ) {
      this.fileName = fileName;
      this.languageScope = new Scope("Language(");
      this.fileScope = new Scope("File(", this.languageScope);
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
      for (const t in NamedType.PRIMITIVE_TYPES) {
         this.languageScope.typeSymbols.set(
            t,
            new Symbol(t, NamedType.PRIMITIVE_TYPES[t])
         );
      }
      this.languageScope.declare(
         new Symbol(
            "print",
            new RoundValueToValueLambdaType(
               [new ParamType(NamedType.PRIMITIVE_TYPES.Anything)],
               NamedType.PRIMITIVE_TYPES.Nothing,
               false,
               false
            ),
            new RoundValueToValueLambda([], new Block([]))
         )
      );
      this.languageScope.declare(
         new Symbol(
            "debug",
            new RoundValueToValueLambdaType(
               [new ParamType(NamedType.PRIMITIVE_TYPES.Anything)],
               NamedType.PRIMITIVE_TYPES.Nothing,
               false,
               false
            ),
            new RoundValueToValueLambda([], new Block([]))
         )
      );
      const innerArrayScope = new Scope("inner-array", this.languageScope);
      innerArrayScope.declareType(new Symbol("T", new GenericNamedType("T")));
      const arrayStruct = new StructType("Array", [
         new ParamType(
            new RoundValueToValueLambdaType(
               [],
               this.languageScope.lookupType("Number").typeSymbol,
               false,
               true
            ),
            "length"
         ),
         new ParamType(
            new RoundValueToValueLambdaType(
               [new ParamType(new NamedType("Number"))],
               new GenericNamedType("T"),
               false,
               true
            ),
            "at"
         ),
         new ParamType(
            new RoundValueToValueLambdaType(
               [
                  new ParamType(
                     new AppliedGenericType(new NamedType("Array"), [
                        new GenericNamedType("T"),
                     ])
                  ),
               ],
               new AppliedGenericType(new NamedType("Array"), [
                  new GenericNamedType("T"),
               ]),
               false,
               true
            ),
            "and"
         ),
      ]);
      const arrayLambdaType = new SquareTypeToTypeLambdaType(
         [new GenericNamedType("T")],
         arrayStruct
      );
      arrayStruct.name = "Array";
      arrayLambdaType.name = "Array";
      this.languageScope.declareType(new Symbol("Array", arrayLambdaType));
      this.languageScope.declare(
         new Symbol(
            "Array@of",
            new SquareTypeToValueLambdaType(
               [new GenericNamedType("T")],
               new RoundValueToValueLambdaType(
                  [
                     new ParamType(
                        new AppliedGenericType(new NamedType("Array"), [
                           new GenericNamedType("T"),
                        ])
                     ),
                  ],
                  new AppliedGenericType(new NamedType("Array"), [
                     new GenericNamedType("T"),
                  ]),
                  true,
                  true
               ),
               true
            )
         ),
         true
      );
      this.languageScope.declare(
         new Symbol(
            "nothing",
            NamedType.PRIMITIVE_TYPES.Nothing,
            new Identifier("nothing")
         )
      );

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
