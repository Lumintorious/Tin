import { TokenPos } from "./Lexer";
import {
   Term,
   AstNode,
   Assignment,
   Identifier,
   RoundValueToValueLambda,
   Block,
} from "./Parser";
import { getConstructorName, TypeErrorList, TypeChecker } from "./TypeChecker";
import { TypeInferencer } from "./TypeInferencer";
import { TypeBuilder } from "./TypeBuilder";
import { TypeTranslator } from "./TypeTranslator";
import {
   AppliedGenericType,
   BinaryOpType,
   GenericNamedType,
   MarkerType,
   NamedType,
   OptionalType,
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
   run: number = 0;
   position?: TokenPos;
   index?: number;
   parentComponent?: Type; // If a field on type ABC, then parentComponent is ABC
   shadowing?: Symbol;
   constructor(name: string, typeSymbol: Type, ast?: Term) {
      this.name = name;
      this.typeSymbol = typeSymbol;
      this.ast = ast;
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
      if (!(template.typeSymbol instanceof UncheckedType)) {
         throw new Error(
            "Attempted to rewrite a checked type symbol. Only unchecked type symbols from run 0 can be rewritten in run 1."
         );
      }
      this.name = template.name;
      this.typeSymbol = template.typeSymbol;
      this.ast = template.ast;
      this.run = template.run;
      this.position = template.position;
      this.index = template.index;
   }
}

export class Scope {
   static maxRuns: number = 1;
   name: string;
   parent?: Scope;
   symbols: Map<string, Symbol> = new Map();
   typeSymbols: Map<string, Type> = new Map();
   symbolsByAst: Map<AstNode, Symbol> = new Map();
   typeSymbolsByAst: Map<AstNode, Type> = new Map();
   childrenByAst: Map<Number, Scope> = new Map();
   currentIndex: number = 0;
   run: number = 0;
   static currentKey = 0;
   constructor(name: string, parent?: Scope) {
      this.name = name;
      this.parent = parent;
      if (parent) {
         this.run = parent.run;
      }
   }

   absorbAllFrom(scope: Scope) {
      scope.symbols.forEach((v, k) => this.symbols.set(k, v));
      scope.typeSymbols.forEach((v, k) => this.typeSymbols.set(k, v));
      scope.symbolsByAst.forEach((v, k) => this.symbolsByAst.set(k, v));
      scope.typeSymbolsByAst.forEach((v, k) => this.typeSymbolsByAst.set(k, v));
      scope.childrenByAst.forEach((v, k) => this.childrenByAst.set(k, v));
      this.currentIndex = this.currentIndex + scope.currentIndex;
   }

   setRun(runNumber: number) {
      this.run = runNumber;
      this.childrenByAst.forEach((v) => {
         v.setRun(runNumber);
      });
   }

   innerScopeOf(astNode: AstNode, canCreate: boolean = false) {
      const ast = astNode as any;
      if (!ast.key) {
         ast.key = Scope.currentKey++;
      }
      const child = this.childrenByAst.get(ast.key);
      if (!child && !canCreate) {
         throw new Error("Could not find child scope " + this.toPath());
      }
      if (child) {
         return child;
      } else {
         const child = new Scope(astNode.tag, this);
         child.run = this.run;
         this.childrenByAst.set(ast.key, child);
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

   mapAst(astNode: AstNode, symbol: Symbol | Type) {
      if (symbol instanceof Symbol) {
         this.symbolsByAst.set(astNode, symbol);
      } else if (symbol instanceof Type) {
         this.typeSymbolsByAst.set(astNode, symbol);
      }
   }

   // Define a new symbol in the current scope
   declare(name: string, symbol: Symbol, redeclare: boolean = false) {
      if (this.symbols.has(name)) {
         const existingSymbol = this.symbols.get(name);
         if (existingSymbol?.typeSymbol instanceof UncheckedType) {
            existingSymbol.rewriteFrom(symbol);
            return;
         } else if (existingSymbol && existingSymbol.run == this.run) {
            if (!redeclare) {
               throw new Error(`Symbol ${name} is already declared.`);
            }
         } else {
            symbol.run = this.run;
         }
      }
      console.log(
         `${name}: ${symbol.typeSymbol.toString()} @ ${this.toPath()}`
      );
      symbol.run = this.run;
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

   declareType(name: string, typeSymbol: Type) {
      if (this.typeSymbols.has(name)) {
         const existingSymbol = this.typeSymbols.get(name);
         if (existingSymbol && existingSymbol.run == this.run) {
            throw new Error(`Symbol ${name} is already declared.`);
         } else {
            typeSymbol.run = this.run;
         }
      }
      console.log(name + ": " + typeSymbol);
      typeSymbol.run = this.run;
      // [T] => type:
      //   value: T
      if (
         typeSymbol instanceof SquareTypeToTypeLambdaType &&
         typeSymbol.returnType instanceof StructType
      ) {
         typeSymbol.name = name;
         const constructorName = getConstructorName(name);
         const constructorSymbol = new Symbol(
            constructorName,
            new SquareTypeToValueLambdaType(
               typeSymbol.paramTypes,
               new RoundValueToValueLambdaType(
                  typeSymbol.returnType.fields.map((f) => f.typeSymbol),
                  new AppliedGenericType(
                     new NamedType(name),
                     typeSymbol.paramTypes
                  )
               )
            )
         );
         this.declare(constructorName, constructorSymbol);
      } else if (typeSymbol instanceof StructType) {
         const constructorName = getConstructorName(name);
         const constructorSymbol = new Symbol(
            constructorName,
            new RoundValueToValueLambdaType(
               typeSymbol.fields.map((f) => f.typeSymbol),
               new NamedType(name)
            )
         );
         this.declare(constructorName, constructorSymbol);
      } else if (typeSymbol instanceof MarkerType) {
         const constructorName = getConstructorName(name);
         const constructorSymbol = new Symbol(
            constructorName,
            new RoundValueToValueLambdaType([], new NamedType(name))
         );
         this.declare(constructorName, constructorSymbol);
      } else if (
         typeSymbol instanceof RoundValueToValueLambdaType &&
         typeSymbol.returnType instanceof StructType
      ) {
         typeSymbol.name = name;
         const constructorName = getConstructorName(name);
         const structTypeSymbol = typeSymbol.returnType;
         const constructorSymbol = new Symbol(
            constructorName,
            new RoundValueToValueLambdaType(
               structTypeSymbol.fields.map((f) => f.typeSymbol),
               typeSymbol
            ).named(constructorName)
         );
         this.declare(constructorName, constructorSymbol);
      }

      typeSymbol.name = name;
      if (!typeSymbol.index) {
         typeSymbol.index = this.currentIndex++;
      }
      this.typeSymbols.set(name, typeSymbol);
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

   hasSymbol(name: string): boolean {
      return this.symbols.has(name) || (this.parent?.hasSymbol(name) ?? false);
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

   lookupType(name: string, scopeName: string = ""): Type {
      if (this.typeSymbols.has(name)) {
         return this.typeSymbols.get(name) as any;
      } else if (this.parent) {
         return this.parent.lookupType(name, this.name + "." + scopeName);
      }
      throw new Error(
         `Type Symbol ${name} not found. Scope = ` + this.name + "." + scopeName
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

   resolveNamedType(type: Type) {
      if (type instanceof NamedType) {
         const realType = this.lookupType(type.name);
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
      return type.resolved;
   }

   resolveGenericTypes(
      type: Type,
      parameters: { [genericName: string]: Type } = {}
   ): Type {
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
            const resolvedParams = lambdaType.paramTypes.map((pt) => {
               return this.resolveGenericTypes(pt, parameters);
            });
            const returnType = this.resolveGenericTypes(
               lambdaType.returnType,
               parameters
            );
            const result = new RoundValueToValueLambdaType(
               resolvedParams,
               returnType
            );
            return result;
         case "StructType":
            if (!(type instanceof StructType)) {
               throw new Error("What the hell??");
            }
            const mappedFields = type.fields.map((f) => {
               return new Symbol(
                  f.name,
                  this.resolveGenericTypes(f.typeSymbol, parameters)
               );
            });
            return new StructType(mappedFields);
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

export class TypePhaseContext {
   languageScope: Scope;
   fileScope: Scope;
   builder: TypeBuilder;
   inferencer: TypeInferencer;
   translator: TypeTranslator;
   checker: TypeChecker;
   errors: TypeErrorList;
   run: number;
   constructor(ast: AstNode, existingFileScopes: Scope[] = []) {
      this.languageScope = new Scope("Language");
      this.fileScope = new Scope("File", this.languageScope);
      this.builder = new TypeBuilder(this);
      this.inferencer = new TypeInferencer(this);
      this.translator = new TypeTranslator(this);
      this.checker = new TypeChecker(this);
      this.errors = new TypeErrorList();
      this.run = 0;
      existingFileScopes.forEach((s) => {
         this.fileScope.absorbAllFrom(s);
      });
      for (const t in NamedType.PRIMITIVE_TYPES) {
         this.languageScope.typeSymbols.set(t, NamedType.PRIMITIVE_TYPES[t]);
      }
      this.languageScope.declare(
         "print",
         new Symbol(
            "print",
            new RoundValueToValueLambdaType(
               [NamedType.PRIMITIVE_TYPES.Any],
               NamedType.PRIMITIVE_TYPES.Nothing
            ),
            new RoundValueToValueLambda([], new Block([]))
         )
      );
      this.languageScope.declare(
         "debug",
         new Symbol(
            "debug",
            new RoundValueToValueLambdaType(
               [NamedType.PRIMITIVE_TYPES.Any],
               NamedType.PRIMITIVE_TYPES.Nothing
            ),
            new RoundValueToValueLambda([], new Block([]))
         )
      );
      const innerArrayScope = new Scope("inner-array", this.languageScope);
      innerArrayScope.declareType("T", new GenericNamedType("T"));
      const arrayStruct = new StructType([
         new Symbol(
            "length",
            new RoundValueToValueLambdaType(
               [],
               this.languageScope.lookupType("Number")
            )
         ),
         new Symbol(
            "at",
            new RoundValueToValueLambdaType(
               [new NamedType("Number")],
               new GenericNamedType("T")
            )
         ),
      ]);
      this.languageScope.declareType(
         "Array",
         new SquareTypeToTypeLambdaType(
            [new GenericNamedType("T")],
            arrayStruct
         )
      );
      this.languageScope.declare(
         "Array",
         new Symbol(
            "Array",
            new SquareTypeToValueLambdaType(
               [new GenericNamedType("T")],
               new RoundValueToValueLambdaType(
                  [
                     new AppliedGenericType(new NamedType("Array"), [
                        new GenericNamedType("T"),
                     ]),
                  ],
                  new AppliedGenericType(new NamedType("Array"), [
                     new GenericNamedType("T"),
                  ]),
                  true
               )
            )
         ),
         true
      );
      this.languageScope.declare(
         "nothing",
         new Symbol(
            "nothing",
            NamedType.PRIMITIVE_TYPES.Nothing,
            new Identifier("nothing")
         )
      );

      this.builder.build(ast, this.fileScope);
      this.run = 1;
      this.languageScope.setRun(1);
      this.fileScope.setRun(1); // Recursive
      this.builder.build(ast, this.fileScope);
      return this;
   }
}
