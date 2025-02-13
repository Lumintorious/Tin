import { TokenPos } from "./Lexer";
import {
   SquareTypeToValueLambda,
   SquareApply,
   DataDef,
   Make,
   TypeCheck,
} from "./Parser";
import { SquareTypeToTypeLambda, parseNewData, Cast } from "./Parser";
import {
   Block,
   Assignment,
   IfStatement,
   TypeDef,
   RoundValueToValueLambda,
   RoundTypeToTypeLambda,
   RoundApply,
   Select,
   UnaryOperator,
   Identifier,
   WhileLoop,
   AstNode,
   Term,
   Literal,
   BinaryExpression,
   Optional,
} from "./Parser";

export function getConstructorName(typeName: string) {
   return typeName;
}

export class Type {
   tag: string;
   name?: string;
   position?: TokenPos;
   ast?: AstNode;
   isForwardReferenceable: boolean = false;
   run?: number;
   index?: number;
   constructor(tag: string = "Unknown") {
      this.tag = tag;
      if (tag === "Unknown") {
         throw new Error("Abstract Type initialization");
      }
   }

   named(name: string): this {
      this.name = name;
      return this;
   }

   isAssignableTo(other: Type, scope: Scope) {
      if (!other) {
         throw new Error("Found undefined type");
      }
      return this.extends(other, scope) || other.isExtendedBy(this, scope);
   }

   extends(other: Type, scope: Scope) {
      return false; // By default, types are not assignable to each other unless overridden
   }

   isExtendedBy(other: Type, scope: Scope) {
      return false;
   }

   equals(other: Type) {
      return this.toString() === other.toString(); // Use string representation for equality check
   }

   located(start?: TokenPos, end?: TokenPos) {
      if (start && end) {
         this.position = new TokenPos(start.start, end.end);
      }
      return this;
   }

   toString(): string {
      return `Unknown ${this.tag}`; // Base export class
   }
}

export class AnyTypeClass extends Type {
   constructor() {
      super("Any");
   }

   isAssignableTo(other: Type, scope: Scope): boolean {
      return true;
   }

   extends(other: Type, scope: Scope) {
      // Named types are assignable if they are equal (same name)
      return other instanceof AnyTypeClass;
   }

   isExtendedBy() {
      return true;
   }

   toString() {
      return "Any";
   }
}

const AnyType = new AnyTypeClass();

export class TypeOfTypes extends Type {
   constructor() {
      super("TypeOfTypes");
   }

   toString(): string {
      return "TypeOfTypes";
   }
}

export class NamedType extends Type {
   static PRIMITIVE_TYPES: { [_: string]: Type } = {
      Int: new NamedType("Int"),
      Number: new NamedType("Number"),
      String: new NamedType("String"),
      Boolean: new NamedType("Boolean"),
      Nothing: new NamedType("Nothing"),
      Type: new NamedType("Type"),
      Any: AnyType,
   };

   name: string;
   constructor(name: string) {
      super("NamedType");
      this.name = name;
   }

   extends(other: Type, scope: Scope) {
      // Named types are assignable if they are equal (same name)
      return other instanceof NamedType && this.name === other.name;
   }

   isExtendedBy(other: Type, scope: Scope) {
      return (
         (other instanceof NamedType && this.name === other.name) ||
         (other.name !== undefined && other.name === this.name)
      );
   }

   toString() {
      return this.name;
   }
}

export class LiteralType extends Type {
   value: string;
   type: Type;
   constructor(value: string, type: Type) {
      super("LiteralType");
      this.value = value;
      this.type = type;
   }

   extends(other: Type, scope: Scope) {
      return this.type.extends(other, scope);
   }

   isExtendedBy(other: Type, scope: Scope): boolean {
      return (
         other instanceof LiteralType &&
         other.type.extends(this.type, scope) &&
         other.value === this.value
      );
   }

   toString() {
      return this.value;
   }
}

export class VarargsType extends Type {
   type: Type;
   constructor(type: Type) {
      super("VarargsType");
      this.type = type;
   }

   toString() {
      return "..." + this.type.toString();
   }
}

export class GenericNamedType extends Type {
   name: string;
   extendedType?: Type;
   superType?: Type;
   constructor(name: string, extendedType?: Type, superType?: Type) {
      super("GenericNamedType");
      this.name = name;
      this.extendedType = extendedType;
      this.superType = superType;
   }

   extends(other: Type, scope: Scope) {
      // Named types are assignable if they are equal (same name)
      return other instanceof NamedType && this.name === other.name;
   }

   isExtendedBy(other: Type, scope: Scope) {
      return other instanceof NamedType && this.name === other.name;
   }

   toString() {
      return this.name;
   }
}

export class OptionalType extends Type {
   type: Type;
   constructor(type: Type) {
      super("OptionalType");
      this.type = type;
   }

   extends(other: Type, scope: Scope) {
      // Named types are assignable if they are equal (same name)
      return (
         this.type.extends(other, scope) ||
         other === NamedType.PRIMITIVE_TYPES.Nothing
      );
   }

   isExtendedBy(other: Type, scope: Scope) {
      return (
         other.isAssignableTo(this.type, scope) ||
         other === NamedType.PRIMITIVE_TYPES.Nothing
      );
   }

   toString() {
      return this.type.toString() + "?";
   }
}

// Type of a RoundValueToValueLambda: (Int) => String
export class RoundValueToValueLambdaType extends Type {
   paramTypes: Type[];
   returnType: Type;
   isGeneric?: boolean;
   constructor(paramTypes: Type[], returnType: Type, isGeneric?: boolean) {
      super("RoundValueToValueLambdaType");
      paramTypes.forEach((p) => {
         if (p.tag === undefined) {
            throw new Error("Empty type");
         }
      });
      this.paramTypes = paramTypes;
      this.returnType = returnType;
      this.isGeneric = isGeneric;
      this.isForwardReferenceable = true;
   }

   extends(other: Type, scope: Scope) {
      if (!(other instanceof RoundValueToValueLambdaType)) return false;
      // Check if parameter types are contravariant
      const paramCheck =
         this.paramTypes.length === other.paramTypes.length &&
         this.paramTypes.every((paramType, index) =>
            other.paramTypes[index].isAssignableTo(paramType, scope)
         );

      // Return type must be covariant
      const returnCheck = this.returnType.isAssignableTo(
         other.returnType,
         scope
      );

      return paramCheck && returnCheck;
   }

   isExtendedBy(other: Type, scope: Scope): boolean {
      return false;
   }

   toString() {
      if (this.name) {
         return this.name;
      }
      const paramsStr = this.paramTypes.map((t) => t.toString()).join(", ");
      return `${this.isGeneric ? "[" : "("}${paramsStr}${
         this.isGeneric ? "]" : ")"
      } => ${this.returnType ? this.returnType.toString() : "undefined"}`;
   }
}

// A RoundValueToValueLambda of Types: [T] => List[T]
// ???
export class TypeRoundValueToValueLambda extends Type {
   paramTypes: Type[];
   returnType: Type;
   constructor(paramTypes: Type[], returnType: Type) {
      super("TypeRoundValueToValueLambda");
      this.paramTypes = paramTypes;
      this.returnType = returnType;
   }

   toString() {
      const paramsStr = this.paramTypes.map((t) => t.toString()).join(", ");
      return `[${paramsStr}] => ${
         this.returnType ? this.returnType.toString() : "undefined"
      }`;
   }
}

export class SquareTypeToValueLambdaType extends Type {
   paramTypes: GenericNamedType[];
   returnType: Type;
   constructor(paramTypes: GenericNamedType[], returnType: Type) {
      super("SquareTypeToValueLambdaType");
      this.paramTypes = paramTypes;
      this.returnType = returnType;
   }

   toString(): string {
      return `[${this.paramTypes
         .map((p) => p.toString())
         .join(", ")}] => ${this.returnType.toString()}`;
   }
}

export class SquareTypeToTypeLambdaType extends Type {
   paramTypes: GenericNamedType[];
   returnType: Type;
   constructor(paramTypes: GenericNamedType[], returnType: Type) {
      super("SquareTypeToTypeLambdaType");
      this.paramTypes = paramTypes;
      this.returnType = returnType;
   }

   toString(): string {
      return `[${this.paramTypes
         .map((p) => p.toString())
         .join(", ")}] => ${this.returnType.toString()}`;
   }
}

export class AppliedGenericType extends Type {
   callee: Type;
   parameterTypes: Type[];
   resolved?: Type;
   constructor(callee: Type, parameterTypes: Type[]) {
      super("AppliedGenericType");
      this.callee = callee;
      this.parameterTypes = parameterTypes;
   }

   extends(other: Type, scope: Scope) {
      if (this.resolved) {
         return this.resolved.extends(other, scope);
      } else if (other instanceof AppliedGenericType) {
         let areAllParamsEqual = true;
         if (this.parameterTypes.length !== other.parameterTypes.length) {
            areAllParamsEqual = false;
         } else {
            for (let i = 0; i < this.parameterTypes.length; i++) {
               if (
                  !this.parameterTypes[i].isAssignableTo(
                     other.parameterTypes[i],
                     scope
                  )
               ) {
                  areAllParamsEqual = false;
                  break;
               }
            }
         }
         return areAllParamsEqual && this.callee.extends(other.callee, scope);
      } else {
         return false;
      }
   }

   isExtendedBy(other: Type, scope: Scope) {
      if (this.resolved) {
         return (
            this.resolved.isExtendedBy(other, scope) ||
            other.extends(this.resolved, scope)
         );
      } else {
         return false;
      }
   }

   toString() {
      const paramsStr = this.parameterTypes.map((t) => t.toString()).join(", ");
      return `${
         this.callee.name ?? `{${this.callee.toString()}}`
      }[${paramsStr}]`;
   }
}

export class BinaryOpType extends Type {
   left: Type;
   operator: string;
   right: Type;
   constructor(left: Type, operator: string, right: Type) {
      super("BinaryOpType");
      this.left = left;
      this.operator = operator;
      this.right = right;
   }

   isAssignableTo(other: Type, scope: Scope): boolean {
      if (
         this.operator === "&" &&
         other instanceof BinaryOpType &&
         other.operator === "&"
      ) {
         return (
            (this.left.isExtendedBy(other.left, scope) &&
               this.right.isExtendedBy(other.right, scope)) ||
            (this.right.isExtendedBy(other.left, scope) &&
               this.left.isExtendedBy(other.right, scope))
         );
      } else if (this.operator === "&") {
         return (
            this.left.isExtendedBy(other, scope) ||
            this.right.isExtendedBy(other, scope)
         );
      } else if (
         this.operator === "|" &&
         other instanceof BinaryOpType &&
         other.operator === "|"
      ) {
         return (
            this.left.extends(other.left, scope) ||
            this.right.extends(other.right, scope) ||
            this.right.extends(other.left, scope) ||
            this.left.extends(other.right, scope)
         );
      } else if (this.operator === "|") {
         return (
            this.left.isAssignableTo(other, scope) ||
            this.right.isAssignableTo(other, scope)
         );
      } else {
         return super.isAssignableTo(other, scope);
      }
   }

   extends(other: Type, scope: Scope) {
      if (this.operator === "&") {
         return (
            other.isAssignableTo(this.left, scope) &&
            other.isAssignableTo(this.right, scope)
         );
      }
      if (
         this.operator === "|" &&
         other instanceof BinaryOpType &&
         other.operator === "|"
      ) {
         return (
            this.left.isExtendedBy(other.left, scope) ||
            this.right.isExtendedBy(other.right, scope) ||
            this.right.isExtendedBy(other.left, scope) ||
            this.left.isExtendedBy(other.right, scope)
         );
      } else if (this.operator === "|") {
         return (
            other.extends(this.left, scope) || other.extends(this.right, scope)
         );
      }
      return false;
   }

   isExtendedBy(other: Type, scope: Scope) {
      if (
         this.operator === "|" &&
         other instanceof BinaryOpType &&
         other.operator === "|"
      ) {
         return (
            this.left.isExtendedBy(other.left, scope) ||
            this.right.isExtendedBy(other.right, scope) ||
            this.right.isExtendedBy(other.left, scope) ||
            this.left.isExtendedBy(other.right, scope)
         );
      } else if (this.operator === "|") {
         return (
            other.isAssignableTo(this.left, scope) ||
            other.isAssignableTo(this.right, scope)
         );
      }
      return false;
   }

   toString() {
      return `${this.left.toString()} ${
         this.operator
      } ${this.right.toString()}`;
   }
}

export class StructType extends Type {
   fields: Symbol[];
   constructor(fields: Symbol[]) {
      super("StructType");
      this.fields = fields; // Array of { name, type } objects
   }

   extends(other: Type, scope: Scope) {
      if (!(other instanceof StructType)) return false;

      // Check if every field in this type exists in the other and is assignable
      return this.fields.every((field) => {
         const otherField = other.fields.find((f) => f.name === field.name);
         return (
            otherField &&
            field.typeSymbol.isAssignableTo(otherField.typeSymbol, scope)
         );
      });
   }

   isExtendedBy(other: Type, scope: Scope) {
      if (!(other instanceof StructType)) return false;

      // Check if every field in this type exists in the other and is assignable
      return this.fields.every((field) => {
         const otherField = other.fields.find((f) => f.name === field.name);
         return (
            otherField !== undefined &&
            field.typeSymbol.isAssignableTo(otherField.typeSymbol, scope)
         );
      });
   }

   toString() {
      return (
         this.name ??
         `StructType(${this.fields.map(
            (f) => `${f.name}::${f.typeSymbol.toString()}`
         )})`
      );
   }
}

export class Symbol {
   name: string;
   typeSymbol: Type;
   ast?: Term;
   run: number = 0;
   position?: TokenPos;
   index?: number;
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
}

export class Scope {
   static maxRuns: number = 1;
   name: string;
   parent?: Scope;
   symbols: Map<string, Symbol> = new Map();
   typeSymbols: Map<string, Type> = new Map();
   symbolsByAst: Map<AstNode, Symbol> = new Map();
   typeSymbolsByAst: Map<AstNode, Type> = new Map();
   childrenByAst: Map<AstNode, Scope> = new Map();
   currentIndex: number = 0;
   run: number = 0;
   constructor(name: string, parent?: Scope) {
      this.name = name;
      this.parent = parent;
   }

   innerScopeOf(astNode: AstNode) {
      const child = this.childrenByAst.get(astNode);
      if (child) {
         return child;
      } else {
         const child = new Scope(astNode.tag, this);
         this.childrenByAst.set(astNode, child);
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
         if (existingSymbol && existingSymbol.run == this.run) {
            if (!redeclare) {
               throw new Error(`Symbol ${name} is already declared.`);
            }
         } else {
            symbol.run = this.run;
         }
      }
      symbol.run = this.run;
      if (!symbol.index) {
         symbol.index = this.currentIndex++;
      }
      console.log(
         "DECLARING {" +
            name +
            " :: " +
            symbol.typeSymbol.toString() +
            "} @ " +
            this.toPath()
      );
      this.symbols.set(name, symbol);
      if (symbol.ast) {
         this.symbolsByAst.set(symbol.ast, symbol);
         if (symbol.ast instanceof Assignment) {
            symbol.ast.symbol = symbol;
         }
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
      typeSymbol.run = this.run;
      // Declare struct constructor
      // if (typeSymbol.tag === "StructType" && typeSymbol instanceof StructType) {
      //    typeSymbol.name = name;
      //    const constructorName = getConstructorName(name);
      //    const constructorSymbol = new Symbol(
      //       constructorName,
      //       new RoundValueToValueLambdaType(
      //          typeSymbol.fields.map((f) => f.typeSymbol),
      //          typeSymbol
      //       ).named(constructorName)
      //    );
      //    this.declare(constructorName, constructorSymbol);
      // }
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
               ).named(constructorName)
            )
         );
         this.declare(constructorName, constructorSymbol);
      }

      if (
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
         return this.symbols.get(name) as any;
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

   lookupType(name: string): Type {
      if (this.typeSymbols.has(name)) {
         return this.typeSymbols.get(name) as any;
      } else if (this.parent) {
         return this.parent.lookupType(name);
      }
      throw new Error(
         `Type Symbol ${name} not found. Scope = ` + this.toPath()
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
}

// TYPE INFERENCER
export class TypeChecker {
   errors: TypeErrorList;
   outerScope: Scope;
   fileScope: Scope;
   run: number = 0;
   constructor() {
      this.errors = new TypeErrorList();
      this.outerScope = new Scope("Language");
      this.fileScope = new Scope("File", this.outerScope);
   }

   deduceCommonType(type1: Type, type2: Type, scope: Scope): Type {
      if (type1.isAssignableTo(type2, scope)) {
         return type2;
      }
      return new BinaryOpType(type1, "|", type2);
   }

   infer(node: AstNode, scope: Scope) {
      let inferredType: Type;
      switch (node.tag) {
         case "Literal":
            inferredType = this.inferLiteral(node as Literal, scope);
            break;
         case "Identifier":
            inferredType = this.inferIdentifier(node as Identifier, scope);
            break;
         // case "WhileLoop":
         //    inferredType = this.inferWhileLoop(node as WhileLoop, scope);
         //    break;
         case "Make":
            const type = this.resolveNamedType(
               this.translateTypeNodeToType((node as Make).type, scope),
               scope
            );
            if (!(type instanceof StructType)) {
               throw new Error("Was not struct type");
            }
            return new RoundValueToValueLambdaType(
               type.fields.map((f) => f.typeSymbol),
               type
            );
         case "Optional":
            inferredType = NamedType.PRIMITIVE_TYPES.Boolean;
            break;
         case "IfStatement":
            inferredType = this.inferIfStatemnet(node as IfStatement, scope);
            break;
         case "BinaryExpression":
            inferredType = this.inferBinaryExpression(
               node as BinaryExpression,
               scope
            );
            break;
         case "RoundValueToValueLambda":
            inferredType = this.inferRoundValueToValueLambda(
               node as RoundValueToValueLambda,
               scope
            );
            break;
         case "SquareTypeToValueLambda":
            if (!(node instanceof SquareTypeToValueLambda)) {
               throw new Error("Bad type");
            }
            inferredType = this.inferSquareTypeToValueLambda(node, scope);
            break;
         case "SquareTypeToTypeLambda":
            if (!(node instanceof SquareTypeToTypeLambda)) {
               throw new Error("Bad type");
            }
            inferredType = this.inferSquareTypeToTypeLambda(node, scope);
            break;
         case "RoundTypeToTypeLambda":
            inferredType = new TypeOfTypes();
            break;
         case "Block":
            inferredType = this.inferBlock(node as Block, scope);
            break;
         case "RoundApply":
            inferredType = this.inferRoundApply(node as RoundApply, scope);
            break;
         case "SquareApply":
            inferredType = this.inferSquareApply(node as SquareApply, scope);
            break;
         case "Select":
            inferredType = this.inferSelect(node as Select, scope);
            break;
         case "TypeDef":
            inferredType = this.inferTypeDef(node as TypeDef, scope);
            break;
         case "Change":
            inferredType = AnyType;
            break;
         case "DataDef":
            inferredType = this.inferData(node as DataDef, scope);
            break;
         case "Assignment":
            inferredType = NamedType.PRIMITIVE_TYPES.Nothing;
            break;
         case "TypeCheck":
            inferredType = NamedType.PRIMITIVE_TYPES.Boolean;
            break;
         case "Cast":
            inferredType = this.translateTypeNodeToType(
               (node as Cast).type,
               scope
            );
            break;
         default:
            throw new Error(
               "Could not infer '" + node.tag + "' - " + node.position
            );
            inferredType = new Type(); // Unknown type by default
      }
      return inferredType;
   }

   inferData(node: DataDef, scope: Scope) {
      return this.translateTypeNodeToType(new TypeDef(node.fieldDefs), scope);
   }

   inferIfStatemnet(node: IfStatement, scope: Scope): Type {
      const innerScope = scope.innerScopeOf(node);
      const trueBranchType = this.infer(node.trueBranch, innerScope);
      let falseBranchType = NamedType.PRIMITIVE_TYPES.Nothing;
      if (node.falseBranch !== undefined) {
         falseBranchType = this.infer(node.falseBranch, innerScope);
      }
      return this.deduceCommonType(trueBranchType, falseBranchType, scope);
   }

   inferTypeDef(node: TypeDef, scope: Scope): Type {
      const fieldSymbols = node.fieldDefs.map((field) => {
         let fieldType: Type;
         if (field.type) {
            fieldType = this.translateTypeNodeToType(field.type, scope);
         } else if (field.defaultValue) {
            fieldType = this.infer(field.defaultValue, scope);
         } else {
            fieldType = new Type();
         }
         return new Symbol(field.name, fieldType, field);
      });
      return new StructType(fieldSymbols);
   }

   inferSquareTypeToTypeLambda(
      node: SquareTypeToTypeLambda,
      scope: Scope
   ): Type {
      return new SquareTypeToTypeLambdaType(
         node.parameterTypes.map((p) => {
            const paramType = this.translateTypeNodeToType(p, scope);
            if (paramType instanceof GenericNamedType) {
               return paramType;
            } else {
               throw new Error(
                  "Expected Generic type as parameter of square lambda, but it wasn't,"
               );
            }
         }),
         this.translateTypeNodeToType(node.returnType, scope)
      );
   }

   inferSquareTypeToValueLambda(
      node: SquareTypeToValueLambda,
      scope: Scope
   ): Type {
      const innerScope = scope.innerScopeOf(node);
      return new SquareTypeToValueLambdaType(
         node.parameterTypes.map((p) => {
            const paramType = this.translateTypeNodeToType(p, innerScope);
            if (paramType instanceof GenericNamedType) {
               return paramType;
            } else {
               throw new Error(
                  "Expected Generic type as parameter of square lambda, but it wasn't,"
               );
            }
         }),
         this.infer(node.block, innerScope)
      );
   }

   buildWhileLoop(node: WhileLoop, scope: Scope) {
      const innerScope = scope.innerScopeOf(node);
      this.build(node.condition, innerScope);
      if (node.start) {
         this.build(node.start, innerScope);
      }
      if (node.eachLoop) {
         this.build(node.eachLoop, innerScope);
      }
      this.build(node.action, innerScope);
   }

   inferSquareApply(node: SquareApply, scope: Scope): Type {
      const calleeType = this.infer(node.callee, scope);
      // For future, check if calleeType is Type, only then go into Generic[Type] building
      if (calleeType instanceof SquareTypeToValueLambdaType) {
         const calledArgs = node.typeArgs.map((t) =>
            this.translateTypeNodeToType(t, scope)
         );
         const expectedArgs = calleeType.paramTypes;
         const params: { [_: string]: Type } = {};
         for (let i = 0; i < calledArgs.length; i++) {
            params[expectedArgs[i].name] = calledArgs[i];
         }
         return this.resolveGenericTypes(calleeType.returnType, params);
      } else if (calleeType.toString() == "Type") {
         const calleeAsType = this.resolveNamedType(
            this.translateTypeNodeToType(node.callee, scope),
            scope
         );
         if (calleeAsType instanceof SquareTypeToTypeLambdaType) {
            const actualParams = node.typeArgs.map((t) =>
               this.translateTypeNodeToType(t, scope)
            );
            const expectedParams = calleeAsType.paramTypes;
            let params: { [_: string]: Type } = {};
            expectedParams.forEach((p, i) => {
               if (p.name) {
                  params[p.name] = actualParams[i];
               }
            });
            return this.resolveGenericTypes(calleeAsType.returnType, params);
         }
      }

      throw new Error(
         `Not calling a function. Object ${
            node.callee.tag
         } is of type ${calleeType.toString()}`
      );
   }

   isCapitalized(str: string) {
      return str.charAt(0) === str.charAt(0).toUpperCase();
   }

   // func = [T, X] -> (thing: T, other: X) -> thing
   // func(12, "Something")
   // = Number
   inferRoundApply(node: RoundApply, scope: Scope): Type {
      const calleeType = this.resolveNamedType(
         this.infer(node.callee, scope),
         scope
      );
      if (
         node.callee instanceof Identifier &&
         this.isCapitalized(node.callee.value)
      ) {
         const type = this.resolveNamedType(
            this.translateTypeNodeToType(node.callee, scope),
            scope
         );
         if (type instanceof StructType) {
            return type;
            // return new RoundValueToValueLambdaType(
            //    type.fields.map((f) => f.typeSymbol),
            //    type
            // );
         } else {
            throw new Error(
               "Cannot call constructor function for non struct-type"
            );
         }
      } else if (calleeType instanceof RoundValueToValueLambdaType) {
         return calleeType.returnType;
      } else if (
         calleeType instanceof SquareTypeToValueLambdaType &&
         calleeType.returnType instanceof RoundValueToValueLambdaType
      ) {
         const mappings = {};
         this.fillInSquareApplyParamsOnRoundApply(
            calleeType.returnType,
            calleeType,
            node,
            scope,
            mappings
         );
         const inferredType = this.resolveGenericTypes(
            calleeType.returnType.returnType,
            mappings
         );
         node.calledInsteadOfSquare = true;
         return inferredType;
      }
      throw new Error(
         `Not calling a function. Object ${
            node.callee.tag
         } is of type ${calleeType.toString()}`
      );
   }

   // Questionable
   inferSelect(node: Select, scope: Scope) {
      let ownerType = this.infer(node.owner, scope);
      if (node.ammortized && ownerType instanceof OptionalType) {
         ownerType = ownerType.type;
      }
      if (
         ownerType instanceof AppliedGenericType &&
         ownerType.resolved !== undefined
      ) {
         ownerType = ownerType.resolved;
      }
      if (ownerType instanceof NamedType) {
         ownerType = scope.lookupType(ownerType.name);
      }
      if (ownerType instanceof AppliedGenericType) {
         ownerType = this.resolvedGeneric(ownerType, scope);
      }
      let fields = this.getAllKnownFields(ownerType, scope);
      fields = fields.filter((f) => f.name === node.field);
      if (!fields[0] || !fields[0].typeSymbol) {
         throw new Error(
            `Field '${node.field}' could not be found on '` +
               ownerType.toString() +
               "'"
         );
      }
      let result = fields[0].typeSymbol;
      if (node.ammortized) {
         result = new OptionalType(result);
      }
      return result;
   }

   getAllKnownFields(type: Type, scope: Scope): Symbol[] {
      if (type instanceof NamedType) {
         return this.getAllKnownFields(
            this.resolveNamedType(type, scope),
            scope
         );
      }
      if (type instanceof StructType) {
         return type.fields;
      } else if (type instanceof BinaryOpType && type.operator == "&") {
         return [
            ...this.getAllKnownFields(type.left, scope),
            ...this.getAllKnownFields(type.right, scope),
         ];
      } else if (type instanceof BinaryOpType && type.operator == "|") {
         const leftFields = this.getAllKnownFields(type.left, scope);
         const rightFields = this.getAllKnownFields(type.right, scope);
         const commonFields = [] as Symbol[];
         for (const leftField of leftFields) {
            const rightField = rightFields.find(
               (f) => f.name === leftField.name
            );
            if (rightField === undefined) continue;
            const leftType = this.resolveNamedType(leftField.typeSymbol, scope);
            const rightType = this.resolveNamedType(
               rightField.typeSymbol,
               scope
            );
            if (rightType.isAssignableTo(leftType, scope)) {
               commonFields.push(leftField);
            } else if (leftType.isAssignableTo(rightType, scope)) {
               commonFields.push(rightField);
            }
         }
         return commonFields;
      }
      return [];
   }

   inferBlock(node: Block, scope: Scope) {
      // TO DO: change to find returns recursively
      const innerScope = scope.innerScopeOf(node);
      if (node.statements.length === 0) {
         return new Type();
      }
      return this.infer(
         node.statements[node.statements.length - 1],
         innerScope
      );
   }

   inferLiteral(node: Literal, scope: Scope) {
      // Handle different literal types (assuming 'Number' is one type)
      if (node.type === "Any" && node.value === "") {
         return AnyType;
      }
      return new LiteralType(String(node.value), scope.lookupType(node.type));
   }

   inferIdentifier(node: Identifier, scope: Scope) {
      if (node.value.charAt(0) === node.value.charAt(0).toUpperCase()) {
         return NamedType.PRIMITIVE_TYPES.Type;
      }
      const symbol = scope.lookup(node.value); // ?? scope.lookupType(node.value);
      if (!symbol) {
         throw new Error(`Undefined identifier: ${node.value}`);
      }
      return symbol.typeSymbol;
   }

   DEFINED_OPERATIONS = {
      NumberNumberNumber: ["+", "-", "*", "/"],
      NumberNumberBoolean: [">", "<", "<=", ">=", "=="],
      StringAnyString: ["+"],
   };

   inferBinaryExpression(node: BinaryExpression, scope: Scope) {
      const leftType = this.infer(node.left, scope);
      const rightType = this.infer(node.right, scope);
      // Here, you would define the logic to determine the resulting type based on the operator
      // For example, if the operator is '+', you might expect both operands to be of type 'Int'
      const Number = scope.lookupType("Number");
      const String = scope.lookupType("String");
      const Boolean = scope.lookupType("Boolean");
      if (node.operator === "?:") {
         const realLeftType =
            leftType instanceof OptionalType ? leftType.type : leftType;
         return this.deduceCommonType(leftType, rightType, scope);
      }
      if (
         (leftType.isAssignableTo(Number, scope) &&
            rightType.isAssignableTo(Number, scope),
         scope)
      ) {
         const entry = this.DEFINED_OPERATIONS.NumberNumberNumber;
         if (entry.includes(node.operator)) {
            return Number;
         }
      }
      if (
         leftType.isAssignableTo(Number, scope) &&
         rightType.isAssignableTo(Number, scope)
      ) {
         const entry = this.DEFINED_OPERATIONS.NumberNumberBoolean;
         if (entry.includes(node.operator)) {
            return Boolean;
         }
      }
      if (leftType.isAssignableTo(String, scope)) {
         const entry = this.DEFINED_OPERATIONS.StringAnyString;
         if (entry.includes(node.operator)) {
            return String;
         }
      }

      if (node.operator === "&") {
         return new BinaryOpType(leftType, "&", rightType);
      }

      if (node.operator === "|") {
         return new BinaryOpType(leftType, "|", rightType);
      }

      // Return a BinaryOpType if types are not directly inferrable
      return new BinaryOpType(leftType, node.operator, rightType);
   }

   inferRoundTypeToTypeLambda(node: RoundTypeToTypeLambda, scope: Scope) {
      const paramScope = scope.innerScopeOf(node);
      node.parameterTypes.forEach((p) => {
         if (p instanceof Assignment && p.lhs instanceof Identifier) {
            paramScope.declareType(
               p.lhs.value,
               new GenericNamedType(
                  p.lhs.value,
                  p.value ? this.infer(p.value, scope) : undefined
               )
            );
         }
      });
      const type = new TypeRoundValueToValueLambda(
         node.parameterTypes.map((p) => {
            if (p instanceof Assignment && p.lhs instanceof Identifier) {
               return this.translateTypeNodeToType(p.lhs, paramScope);
            } else {
               throw new Error("Params weren't assignment types");
            }
         }),
         this.infer(node.returnType, paramScope)
      );
      return type;
   }

   // func = [T, X] -> (thing: T, other: X) -> 2
   // func(12, "Hello")
   // T: Number, X: String
   fillInSquareApplyParamsOnRoundApply(
      roundLambda: RoundValueToValueLambdaType,
      squareLambda: SquareTypeToValueLambdaType,
      roundApply: RoundApply,
      scope: Scope,
      mappings: { [_: string]: Type }
   ) {
      const expectedValueParams: Type[] = roundLambda.paramTypes;
      const expectedTypeParams: GenericNamedType[] =
         squareLambda.paramTypes.map((p) => {
            const pType = p;
            if (pType instanceof GenericNamedType) {
               return pType;
            } else {
               throw new Error(
                  "Expected generic types for SquareTypeToTypeLambda"
               );
            }
         });
      const suppliedParams: Term[] = roundApply.args;
      for (let i = 0; i < suppliedParams.length; i++) {
         const typeofSuppliedParam: Type = this.infer(suppliedParams[i], scope);
         const typeofExpectedParam: Type = expectedValueParams[i];
         if (
            typeofExpectedParam instanceof NamedType ||
            typeofExpectedParam instanceof GenericNamedType
         ) {
            const typeNameToFind = typeofExpectedParam.name;
            const indexOfTypeInSquareLambda = expectedTypeParams.findIndex(
               (v) => v.name === typeNameToFind
            );
            mappings[typeNameToFind] = typeofSuppliedParam;
         }
      }
   }

   // (i: Number) -> i + 2
   inferRoundValueToValueLambda(node: RoundValueToValueLambda, scope: Scope) {
      const innerScope = scope.innerScopeOf(node);
      innerScope.run = this.run;
      let paramTypes = [];
      // Check for Varargs expected type
      if (
         node.params[0] &&
         node.params[0] instanceof Assignment &&
         node.params[0].type &&
         node.params[0].type instanceof UnaryOperator &&
         node.params[0].type.operator === "..."
      ) {
         const param = node.params[0];
         const paramType = new AppliedGenericType(
            innerScope.lookupType("Array"),
            [
               this.translateTypeNodeToType(
                  node.params[0].type.expression,
                  innerScope
               ),
            ]
         );
         // paramType.resolved = innerScope.lookup("Array").returnType;
         paramTypes = [paramType];
         if (param instanceof Assignment && param.lhs instanceof Identifier) {
            if (!innerScope.hasSymbol(param.lhs.value)) {
               innerScope.declare(
                  param.lhs.value,
                  new Symbol(param.lhs.value, paramType, param)
               );
            }
         }
      } else {
         paramTypes = node.params.map((param) => {
            let type;
            if (param instanceof Assignment) {
               if (param.type) {
                  type = this.translateTypeNodeToType(param.type, innerScope);
               } else if (param.value) {
                  type = this.infer(param.value, innerScope);
               }
            } else if (
               node.isTypeLambda &&
               param instanceof Assignment &&
               param.lhs instanceof Identifier
            ) {
               type = new NamedType(param.lhs.value);
            }
            if (!type) {
               throw new Error(
                  "Cannot tell type. Maybe you used : instead of ::"
               );
               type = new Type();
            }

            // if (
            //    param instanceof Assignment &&
            //    param.lhs instanceof Identifier
            // ) {
            //    innerScope.declare(
            //       param.lhs.value,
            //       new Symbol(param.lhs.value, type, param)
            //    );
            // }
            return type;
            // throw new Error(`Missing type annotation or default value for parameter: ${param.name}`);
         });
      }

      if (
         node.isTypeLambda &&
         node instanceof RoundValueToValueLambda &&
         node.block instanceof Block &&
         node.block.statements[0]
      ) {
         node.params.forEach((p) => {
            if (p instanceof Assignment && p.lhs instanceof Identifier) {
               innerScope.declareType(p.lhs.value, new NamedType(p.lhs.value));
            }
         });
         const returnType = this.translateTypeNodeToType(
            node.block.statements[0],
            innerScope
         );
         const lambdaType = new RoundValueToValueLambdaType(
            paramTypes,
            returnType,
            true
         );
         return lambdaType;
      } else {
         const returnType = this.infer(node.block, innerScope);
         if (node.explicitType) {
            const explicitType = this.translateTypeNodeToType(
               node.explicitType,
               innerScope
            );
            if (!returnType.isAssignableTo(explicitType, scope)) {
               this.errors.add(
                  `Return type of lambda`,
                  explicitType,
                  returnType,
                  node.position,
                  new Error()
               );
            }
         }
         const lambdaType = new RoundValueToValueLambdaType(
            paramTypes,
            returnType
         );
         return lambdaType;
      }
   }

   resolvedGeneric(type: AppliedGenericType, scope: Scope): Type {
      let callee = type.callee;
      if (callee instanceof Identifier) {
         callee = scope.lookupType(callee.value);
      }
      if (callee instanceof NamedType) {
         callee = scope.lookupType(callee.name);
      }
      if (callee && callee instanceof RoundValueToValueLambdaType) {
         const actualParams = type.parameterTypes;
         const expectedParams = callee.paramTypes;
         let params: { [_: string]: Type } = {};
         expectedParams.forEach((p, i) => {
            if (p.name) {
               params[p.name] = actualParams[i];
            }
         });
         const resolved = this.resolveGenericTypes(callee.returnType, params);
         type.resolved = resolved;
         return type.resolved;
      }
      if (callee && callee instanceof SquareTypeToTypeLambdaType) {
         const actualParams = type.parameterTypes;
         const expectedParams = callee.paramTypes;
         let params: { [_: string]: Type } = {};
         expectedParams.forEach((p, i) => {
            if (p.name) {
               params[p.name] = actualParams[i];
            }
         });
         const resolved = this.resolveGenericTypes(callee.returnType, params);
         type.resolved = resolved;
         return type.resolved;
      }
      throw new Error("Could not resolve generic type " + type.toString());
   }

   resolveAppliedGenericTypes(type: Type, scope: Scope) {
      if (!(type instanceof AppliedGenericType)) {
         return type;
      }
      const typeCallee = this.resolveNamedType(type.callee, scope);
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
         default:
            return type;
      }
   }

   translateTypeNodeToType(node: AstNode, scope: Scope): Type {
      switch (node.tag) {
         case "Identifier":
            // return scope.lookupType((node as Identifier).value);
            return new NamedType((node as Identifier).value);
         case "Literal":
            const literal = node as Literal;

            return new LiteralType(
               String(literal.value),
               NamedType.PRIMITIVE_TYPES[literal.type]
            );
         case "Assignment":
            if (
               node instanceof Assignment &&
               !node.isDeclaration &&
               node.symbol
            ) {
               return node.symbol?.typeSymbol;
            }
            if (
               node instanceof Assignment &&
               node.lhs instanceof Identifier &&
               !node.value
            ) {
               const name = node.lhs.value;
               const extendedType = node.type
                  ? this.translateTypeNodeToType(node.type, scope)
                  : undefined;
               return new GenericNamedType(name, extendedType);
            }
            return new Type();
         case "UnaryOperator":
            if (!(node instanceof UnaryOperator)) {
               throw Error("Not right type");
            }
            if (node.operator === "...") {
               return new VarargsType(
                  this.translateTypeNodeToType(node.expression, scope)
               );
            } else {
               throw new Error("Unexpected unary operator");
            }
         case "GenericNamedType":
            if (!(node instanceof GenericNamedType)) {
               throw Error("Not right type");
            }
            return node;
         case "RoundTypeToTypeLambda":
            if (!(node instanceof RoundTypeToTypeLambda)) {
               throw Error("Not right type");
            }
            return new RoundValueToValueLambdaType(
               node.parameterTypes.map((p) => {
                  let translated = this.translateTypeNodeToType(p, scope);
                  if (translated instanceof GenericNamedType) {
                     return new NamedType(translated.name);
                  }
                  return translated;
               }),
               this.translateTypeNodeToType(node.returnType, scope)
            );
         case "RoundValueToValueLambda":
            // return new RoundValueToValueLambdaType(node.params.map(p => this.translateTypeNodeToType(p, scope/)))
            if (!(node instanceof RoundValueToValueLambda)) {
               throw new Error("Weird type");
            }
            const innerScope = scope.innerScopeOf(node);
            innerScope.run = this.run;
            // innerScope.declareType("T", new NamedType("T"));
            return new RoundValueToValueLambdaType(
               node.params.map((p) =>
                  this.translateTypeNodeToType(p, innerScope)
               ),
               this.translateTypeNodeToType(
                  node.block.statements[0],
                  innerScope
               ),
               node.isTypeLambda
            );
         case "SquareTypeToTypeLambda":
            // return new RoundValueToValueLambdaType(node.params.map(p => this.translateTypeNodeToType(p, scope/)))
            if (!(node instanceof SquareTypeToTypeLambda)) {
               throw new Error("Weird type");
            }
            const innerScope2 = scope.innerScopeOf(node);
            innerScope2.run = this.run;
            innerScope2.declareType("T", new NamedType("T"));
            const genericParameters = node.parameterTypes.map((p) => {
               const param = this.translateTypeNodeToType(p, innerScope2);
               if (param instanceof GenericNamedType) {
                  return param;
               } else {
                  throw new Error("Expected Generic parameter, but it wasn't");
               }
            });
            return new SquareTypeToTypeLambdaType(
               genericParameters,
               this.translateTypeNodeToType(node.returnType, innerScope2)
            );
         case "SquareApply":
            if (!(node instanceof SquareApply)) {
               return new Type();
            }
            return new AppliedGenericType(
               this.translateTypeNodeToType(node.callee, scope),
               node.typeArgs.map((arg) =>
                  this.translateTypeNodeToType(arg, scope)
               )
            );
         case "TypeDef":
            if (!(node instanceof TypeDef)) {
               return new Type();
            }
            const fieldTypes = node.fieldDefs.map((f) => {
               let fieldType: Type;
               if (f.type) {
                  fieldType = this.translateTypeNodeToType(f.type, scope);
               } else if (f.defaultValue) {
                  fieldType = this.infer(f.defaultValue, scope);
               } else {
                  fieldType = new Type();
               }
               return new Symbol(f.name, fieldType, f);
            });
            return new StructType(fieldTypes);
         case "RoundApply":
            if (!(node instanceof RoundApply)) {
               return new Type();
            }
            throw new Error(
               "Was type apply, but not isTypeRoundValueToValueLambda. "
            );
         case "BinaryExpression":
            if (!(node instanceof BinaryExpression)) {
               return new Type();
            }
            return new BinaryOpType(
               this.translateTypeNodeToType(node.left, scope),
               node.operator,
               this.translateTypeNodeToType(node.right, scope)
            );
         case "Optional":
            if (!(node instanceof Optional)) {
               return new Type();
            }
            return new OptionalType(
               this.translateTypeNodeToType(node.expression, scope)
            );
         default:
            throw new Error("Could not translate " + node.tag);
      }
   }

   typeCheck(node: AstNode, scope: Scope) {
      if (node instanceof Block) {
         const innerScope = scope.innerScopeOf(node);
         node.statements.forEach((c) =>
            this.typeCheck.bind(this)(c, innerScope)
         );
      } else if (node instanceof Assignment && node.value) {
         this.typeCheck(node.value, scope);
      } else if (node instanceof RoundApply) {
         this.typeCheckApply(node, scope);
      } else if (node instanceof RoundValueToValueLambda) {
         this.typeCheckRoundValueToValueLambda(node, scope);
      } else if (node instanceof SquareTypeToValueLambda) {
         this.typeCheckSquareTypeToValueLambda(node, scope);
      } else if (node instanceof IfStatement) {
         const innerScope = scope.innerScopeOf(node);
         this.typeCheck(node.condition, innerScope);
         this.typeCheck(node.trueBranch, innerScope);
         if (node.falseBranch) {
            this.typeCheck(node.falseBranch, innerScope);
         }
      }
   }

   typeCheckRoundValueToValueLambda(
      node: RoundValueToValueLambda,
      scope: Scope
   ) {
      const innerScope = scope.innerScopeOf(node);
      node.params.forEach((p) => this.typeCheck(p, innerScope));
      this.typeCheck(node.block, innerScope);
   }

   typeCheckSquareTypeToValueLambda(
      node: SquareTypeToValueLambda,
      scope: Scope
   ) {
      const innerScope = scope.innerScopeOf(node);
      // node.pforEach((p) => this.typeCheck(p, innerScope));
      this.typeCheck(node.block, innerScope);
   }

   // typeCheckSquareApply(apply: SquareApply, scope: Scope) {
   // 	apply.
   // }

   typeCheckApply(apply: RoundApply, scope: Scope) {
      // let symbol =
      //    apply.callee instanceof Identifier
      //       ? scope.lookup(apply.callee.value)
      //       : this.infer(apply.callee, scope);

      let typeSymbol = this.infer(apply.callee, scope);
      if (
         apply.callee instanceof Identifier &&
         this.isCapitalized(apply.callee.value)
      ) {
         const type = this.resolveNamedType(
            this.translateTypeNodeToType(apply.callee, scope),
            scope
         );
         if (type instanceof StructType) {
            typeSymbol = new RoundValueToValueLambdaType(
               type.fields.map((f) => f.typeSymbol),
               type
            );
         } else {
            throw new Error(
               "Cannot call constructor function for non struct-type"
            );
         }
      }
      apply.args.forEach((p) => {
         this.typeCheck(p, scope);
      });

      if (
         // symbol instanceof Symbol &&
         typeSymbol instanceof RoundValueToValueLambdaType
      ) {
         const params = typeSymbol.paramTypes;
         if (
            params[0] &&
            params[0] instanceof AppliedGenericType &&
            params[0].callee.name === "Array"
         ) {
            const expectedType = params[0].parameterTypes[0];
            apply.args.forEach((p, i) => {
               const gottenType = this.infer(p, scope);
               if (!gottenType.isAssignableTo(expectedType, scope)) {
                  this.errors.add(
                     `Parameter ${i} of ${
                        apply.callee instanceof Identifier
                           ? apply.callee.value
                           : "Anonymous function"
                     }`,
                     expectedType,
                     gottenType,
                     apply.position,
                     new Error()
                  );
               }
            });
            apply.takesVarargs = true;
         } else {
            apply.args.forEach((p, i) => {
               if (!(typeSymbol instanceof RoundValueToValueLambdaType)) {
                  return;
               }
               const type = this.resolveNamedType(this.infer(p, scope), scope);
               if (
                  !type.isAssignableTo(
                     this.resolveNamedType(typeSymbol.paramTypes[i], scope),
                     scope
                  )
               ) {
                  this.errors.add(
                     `Parameter ${i} of ${
                        apply.callee instanceof Identifier
                           ? apply.callee.value
                           : "Anonymous function"
                     }`,
                     typeSymbol.paramTypes[i],
                     type,
                     apply.position,
                     new Error()
                  );
               }
            });
         }

         // }
      }
   }

   // Build symbol table from AST
   static fromAST(ast: AstNode) {
      const typeChecker = new TypeChecker();
      const languageScope = typeChecker.outerScope;
      for (const t in NamedType.PRIMITIVE_TYPES) {
         languageScope.typeSymbols.set(t, NamedType.PRIMITIVE_TYPES[t]);
      }
      languageScope.declare(
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
      const innerArrayScope = new Scope("inner-array", languageScope);
      innerArrayScope.declareType("T", new GenericNamedType("T"));
      const arrayStruct = new StructType([
         new Symbol(
            "length",
            new RoundValueToValueLambdaType(
               [],
               languageScope.lookupType("Number")
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
      languageScope.declareType(
         "Array",
         new SquareTypeToTypeLambdaType(
            [new GenericNamedType("T")],
            arrayStruct
         )
      );
      languageScope.declare(
         "nothing",
         new Symbol(
            "nothing",
            NamedType.PRIMITIVE_TYPES.Nothing,
            new Identifier("nothing")
         )
      );
      const fileScope = typeChecker.fileScope;
      typeChecker.outerScope = fileScope;
      fileScope.run = 0;
      typeChecker.build(ast, fileScope);
      typeChecker.run = 1;
      typeChecker.outerScope.run = 1;
      fileScope.run = 1;
      typeChecker.build(ast, fileScope);
      return typeChecker;
   }

   resolveNamedType(type: Type, scope: Scope) {
      if (type instanceof NamedType) {
         const realType = scope.lookupType(type.name);
         realType.name = type.name;
         return realType;
      } else {
         return type;
      }
   }

   // Walk through the AST and infer types for definitions
   build(node: AstNode, scope: Scope) {
      if (node instanceof Assignment) {
         this.buildSymbolForAssignment(node, scope);
      } else if (node instanceof Block) {
         const innerBlockScope = scope.innerScopeOf(node);
         node.statements.forEach((statement) =>
            this.build(statement, innerBlockScope)
         );
      } else if (node instanceof RoundValueToValueLambda) {
         this.buildRoundValueToValueLambda(node, scope);
      } else if (node instanceof SquareTypeToValueLambda) {
         this.buildSquareTypeToValueLambda(node, scope);
      } else if (node instanceof WhileLoop) {
         this.buildWhileLoop(node, scope);
      } else if (node instanceof TypeDef) {
         this.buildStruct(node, scope);
      } else if (node instanceof IfStatement) {
         const innerScope = scope.innerScopeOf(node);
         const trueScope = innerScope.innerScopeOf(node.trueBranch);
         if (
            node.condition instanceof TypeCheck &&
            node.condition.term instanceof Identifier
         ) {
            const presumedType = this.translateTypeNodeToType(
               node.condition.type,
               innerScope
            );
            trueScope.declare(
               node.condition.term.value,
               new Symbol(
                  node.condition.term.value,
                  presumedType,
                  node.condition.term
               ),
               true
            );
         }
         this.build(node.condition, innerScope);
         this.build(node.trueBranch, trueScope);
         if (node.falseBranch) {
            this.build(node.falseBranch, innerScope);
         }
      }
   }

   buildStruct(node: TypeDef, scope: Scope) {
      // const fieldSymbols = node.fieldDefs.map((field) => {
      //    return new Symbol(
      //       field.name,
      //       this.translateTypeNodeToType(field.type, scope),
      //       field
      //    );
      // });
      // scope.declareType(new StructType(fieldSymbols))
   }

   buildRoundValueToValueLambda(node: RoundValueToValueLambda, scope: Scope) {
      const innerScope = scope.innerScopeOf(node);
      node.params.forEach((p) => {
         if (p instanceof Assignment && p.lhs instanceof Identifier) {
            const hasSymbol = innerScope.hasSymbol(p.lhs.value);
            if (hasSymbol) {
               return;
            }
            this.build(p, innerScope);
         }
      });
      this.build(node.block, innerScope);
   }

   buildSquareTypeToValueLambda(node: SquareTypeToValueLambda, scope: Scope) {
      const innerScope = scope.innerScopeOf(node);
      node.parameterTypes.forEach((p) => {
         const type = this.translateTypeNodeToType(p, innerScope);
         if (type instanceof GenericNamedType) {
            if (!innerScope.hasTypeSymbol(type.name)) {
               innerScope.declareType(type.name, type);
            }
         }
      });
      this.build(node.block, innerScope);
   }

   buildSymbolForAssignment(node: Assignment, scope: Scope) {
      // If it's not a declaration
      if (
         this.run == 0 &&
         node.lhs instanceof Identifier &&
         scope.hasSymbol(node.lhs.value)
      ) {
         node.isDeclaration = false;
         return;
      }

      const lhs = node.lhs;
      // Means it's a parameter
      if (!node.value) {
         if (node.type && node.lhs instanceof Identifier) {
            const symbol = new Symbol(
               node.lhs.value,
               this.translateTypeNodeToType(node.type, scope),
               node
            );
            scope.declare(node.lhs.value, symbol);
         }
         return;
      }
      this.build(node.value, scope);
      let rhsType = this.infer(node.value, scope);
      if (!node.type) {
         scope.mapAst(node, rhsType ? rhsType : new Type());
      } else {
         let nodeType = this.resolveNamedType(
            this.translateTypeNodeToType(node.type, scope),
            scope
         );
         if (nodeType instanceof AppliedGenericType) {
            this.resolveAppliedGenericTypes(nodeType, scope);
         }
         if (
            !rhsType.isAssignableTo(
               this.resolveNamedType(nodeType, scope),
               scope
            )
         ) {
            this.errors.add(
               `Assignment of ${
                  node.lhs instanceof Identifier ? node.lhs.value : "term"
               }`,
               nodeType,
               rhsType,
               node.position,
               new Error()
            );
         } else {
            rhsType = this.resolveNamedType(nodeType, scope);
         }
      }
      if (
         node.lhs instanceof Identifier &&
         (node.isTypeLevel || node.lhs.isTypeLevel) &&
         node.lhs.value
      ) {
         if (node.value instanceof RoundTypeToTypeLambda) {
            scope.declareType(
               node.lhs.value,
               this.translateTypeNodeToType(node.value, scope)
            );
         } else {
            const symbolToDeclare = this.translateTypeNodeToType(
               node.value,
               scope
            );
            if (!scope.hasTypeSymbol(node.lhs.value)) {
               scope.declareType(node.lhs.value, symbolToDeclare);
            }
         }
         return;
      }
      if (!(lhs instanceof Identifier)) {
         throw new Error("LHS was not Identifier");
      }
      let symbol = new Symbol(lhs.value, rhsType, node);

      if (node.isDeclaration) {
         symbol = symbol.located(node.position, node.position);
         if (!scope.hasSymbol(lhs.value)) {
            scope.declare(lhs.value, symbol);
            node.symbol = symbol;
         }
      }
   }
}

export class TypeErrorList {
   errors: {
      hint: string;
      expectedType: Type;
      insertedType: Type;
      position?: TokenPos;
      errorForStack?: Error;
   }[];
   constructor() {
      this.errors = [];
   }

   add(
      hint: string,
      expectedType: Type,
      insertedType: Type,
      position?: TokenPos,
      errorForStack?: Error
   ) {
      this.errors.push({
         hint,
         expectedType,
         insertedType,
         position,
         errorForStack,
      });
   }

   throwAll(showStack = true) {
      if (this.errors.length > 0) {
         const message =
            "There are type errors:\n" +
            this.errors
               .map(
                  (e) =>
                     `- ${
                        e.hint
                     }; Expected '${e.expectedType.toString()}', but got '${
                        e.insertedType
                     }' at line ${e.position?.start.line}, column ${
                        e.position?.start.column
                     }`
               )
               .join("\n");
         console.error(message);
         process.exit(-1);
      }
   }
}
