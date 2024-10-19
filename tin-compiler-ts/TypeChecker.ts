import { TokenPos } from "./Lexer";
import {
   Block,
   Assignment,
   IfStatement,
   TypeDef,
   Lambda,
   Parameter,
   LambdaTypeTerm,
   Apply,
   Select,
   UnaryOperator,
   Identifier,
   AstNode,
   Term,
   Literal,
   BinaryExpression,
   Optional,
} from "./Parser";

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

   isAssignableTo(other: Type) {
      if (!other) {
         throw new Error("Found undefined type");
      }
      return this.extends(other) || other.isExtendedBy(this);
   }

   extends(other: Type) {
      return false; // By default, types are not assignable to each other unless overridden
   }

   isExtendedBy(other: Type) {
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
      return `Unknown`; // Base export class
   }
}

export class AnyTypeClass extends Type {
   constructor() {
      super("Any");
   }

   extends(other: Type) {
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
      Void: new NamedType("Void"),
      Type: new NamedType("Type"),
      Any: AnyType,
   };

   name: string;
   constructor(name: string) {
      super("NamedType");
      this.name = name;
   }

   extends(other: Type) {
      // Named types are assignable if they are equal (same name)
      return other instanceof NamedType && this.name === other.name;
   }

   isExtendedBy(other: Type) {
      return (
         (other instanceof NamedType && this.name === other.name) ||
         (other.name !== undefined && other.name === this.name)
      );
   }

   toString() {
      return this.name;
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

   extends(other: Type) {
      // Named types are assignable if they are equal (same name)
      return other instanceof NamedType && this.name === other.name;
   }

   isExtendedBy(other: Type) {
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

   extends(other: Type) {
      // Named types are assignable if they are equal (same name)
      return this.type.extends(other);
   }

   isExtendedBy(other: Type) {
      return other.isAssignableTo(this.type);
   }

   toString() {
      return this.type.toString() + "?";
   }
}

// Type of a Lambda: (Int) => String
export class LambdaType extends Type {
   paramTypes: Type[];
   returnType: Type;
   isGeneric?: boolean;
   constructor(paramTypes: Type[], returnType: Type, isGeneric?: boolean) {
      super("LambdaType");
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

   extends(other: Type) {
      if (!(other instanceof LambdaType)) return false;

      // Check if parameter types are contravariant
      const paramCheck =
         this.paramTypes.length === other.paramTypes.length &&
         this.paramTypes.every((paramType, index) =>
            other.paramTypes[index].isAssignableTo(paramType)
         );

      // Return type must be covariant
      const returnCheck = this.returnType.isAssignableTo(other.returnType);

      return paramCheck && returnCheck;
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

// A Lambda of Types: [T] => List[T]
export class TypeLambda extends Type {
   paramTypes: Type[];
   returnType: Type;
   constructor(paramTypes: Type[], returnType: Type) {
      super("TypeLambda");
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

export class AppliedGenericType extends Type {
   callee: Type;
   parameterTypes: Type[];
   resolved?: Type;
   constructor(callee: Type, parameterTypes: Type[]) {
      super("AppliedGenericType");
      this.callee = callee;
      this.parameterTypes = parameterTypes;
   }

   extends(other: Type) {
      if (this.resolved) {
         return this.resolved.extends(other);
      } else {
         return false;
      }
   }

   isExtendedBy(other: Type) {
      if (this.resolved) {
         return this.resolved.isExtendedBy(other);
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

   extends(other: Type) {
      if (this.operator === "&") {
         return (
            other.isAssignableTo(this.left) && other.isAssignableTo(this.right)
         );
      }
      return false;
   }

   isExtendedBy(other: Type) {
      if (this.operator === "|") {
         return (
            other.isAssignableTo(this.left) || other.isAssignableTo(this.right)
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

   extends(other: Type) {
      if (!(other instanceof StructType)) return false;

      // Check if every field in this type exists in the other and is assignable
      return this.fields.every((field) => {
         const otherField = other.fields.find((f) => f.name === field.name);
         return (
            otherField && field.typeSymbol.isAssignableTo(otherField.typeSymbol)
         );
      });
   }

   toString() {
      return this.name ?? `StructType(${this.fields.map((f) => f.name)})`;
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
      if (now) {
         str += now.name + " - ";
         now = now.parent;
      }
      return str;
   }

   mapAst(astNode: AstNode, symbol: Symbol | Type) {
      if (symbol instanceof Symbol) {
         this.symbolsByAst.set(astNode, symbol);
      } else if (symbol instanceof Type) {
         this.typeSymbolsByAst.set(astNode, symbol);
      }
   }

   // Define a new symbol in the current scope
   declare(name: string, symbol: Symbol) {
      if (this.symbols.has(name)) {
         const existingSymbol = this.symbols.get(name);
         if (existingSymbol && existingSymbol.run == this.run) {
            throw new Error(`Symbol ${name} is already declared.`);
         } else {
            symbol.run = this.run;
         }
      }
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
      if (typeSymbol.tag === "StructType" && typeSymbol instanceof StructType) {
         typeSymbol.name = name;
         const constructorSymbol = new Symbol(
            "make" + name,
            new LambdaType(
               typeSymbol.fields.map((f) => f.typeSymbol),
               typeSymbol
            ).named("make" + name)
         );
         this.declare("make" + name, constructorSymbol);
      }
      if (
         typeSymbol instanceof LambdaType &&
         typeSymbol.returnType instanceof StructType
      ) {
         typeSymbol.name = name;
         const structTypeSymbol = typeSymbol.returnType;
         const constructorSymbol = new Symbol(
            "make" + name,
            new LambdaType(
               structTypeSymbol.fields.map((f) => f.typeSymbol),
               typeSymbol
            ).named("make" + name)
         );
         this.declare("make" + name, constructorSymbol);
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
      this.outerScope = new Scope("outer");
      this.fileScope = new Scope("file", this.outerScope);
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
         case "BinaryExpression":
            inferredType = this.inferBinaryExpression(
               node as BinaryExpression,
               scope
            );
            break;
            break;
         case "Lambda":
            inferredType = this.inferLambda(node as Lambda, scope);
            break;
         case "LambdaType":
            inferredType = this.inferLambdaType(node as LambdaTypeTerm, scope);
            break;
         case "Block":
            inferredType = this.inferBlock(node as Block, scope);
            break;
         case "Apply":
            inferredType = this.inferApply(node as Apply, scope);
            break;
         // Add more cases for other AST nodes as needed
         case "Select":
            inferredType = this.inferSelect(node as Select, scope);
            break;
         case "TypeDef":
            inferredType = new TypeOfTypes();
            break;
         default:
            throw new Error(
               "Could not infer " + node.tag + " - " + node.position
            );
            inferredType = new Type(); // Unknown type by default
      }
      // node.typeSymbol = inferredType.toString();
      return inferredType;
   }

   inferApply(node: Apply, scope: Scope): Type {
      const calleeType = this.infer(node.callee, scope);
      if (calleeType instanceof LambdaType) {
         return calleeType.returnType;
      } else {
         throw new Error(
            `Not calling a function. Object ${
               node.callee.tag
            } is of type ${calleeType.toString()}`
         );
      }
   }

   // Questionable
   inferSelect(node: Select, scope: Scope) {
      let ownerType = this.infer(node.owner, scope);
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
      if (!(ownerType instanceof StructType)) {
         console.error(ownerType);
         return new Type();
      }
      const fields = ownerType.fields.filter((f) => f.name === node.field);
      if (!fields[0] || !fields[0].typeSymbol) {
         throw new Error(
            `Field '${node.field}' could not be found on '` +
               ownerType.toString() +
               "'"
         );
      }
      return fields[0].typeSymbol;
   }

   inferBlock(node: Block, scope: Scope) {
      // TO DO: change to find returns recursively
      if (node.statements.length === 0) {
         return new Type();
      }
      return this.infer(node.statements[node.statements.length - 1], scope);
   }

   inferLiteral(node: Literal, scope: Scope) {
      // Handle different literal types (assuming 'Number' is one type)
      return scope.lookupType(node.type);
   }

   inferIdentifier(node: Identifier, scope: Scope) {
      if (node.value.charAt(0) === node.value.charAt(0).toUpperCase()) {
         return NamedType.PRIMITIVE_TYPES.Type;
      }
      const symbol = scope.lookup(node.value) ?? scope.lookupType(node.value);
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
      if (leftType.isAssignableTo(Number) && rightType.isAssignableTo(Number)) {
         const entry = this.DEFINED_OPERATIONS.NumberNumberNumber;
         if (entry.includes(node.operator)) {
            return Number;
         }
      }
      if (leftType.isAssignableTo(Number) && rightType.isAssignableTo(Number)) {
         const entry = this.DEFINED_OPERATIONS.NumberNumberBoolean;
         if (entry.includes(node.operator)) {
            return Boolean;
         }
      }
      if (leftType.isAssignableTo(String)) {
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

   inferLambdaType(node: LambdaTypeTerm, scope: Scope) {
      const paramScope = scope.innerScopeOf(node);
      node.parameterTypes.forEach((p) => {
         if (p instanceof Assignment && p.lhs instanceof Identifier) {
            paramScope.declareType(
               p.lhs.value,
               new GenericNamedType(
                  p.lhs.value,
                  p.value ? this.infer(p.value, scope) : AnyType
               )
            );
         }
      });
      const type = new TypeLambda(
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

   inferLambda(node: Lambda, scope: Scope) {
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
            innerScope.declare(
               param.lhs.value,
               new Symbol(param.lhs.value, paramType, param)
            );
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

            if (
               param instanceof Assignment &&
               param.lhs instanceof Identifier
            ) {
               innerScope.declare(
                  param.lhs.value,
                  new Symbol(param.lhs.value, type, param)
               );
            }
            return type;
            // throw new Error(`Missing type annotation or default value for parameter: ${param.name}`);
         });
      }

      if (
         node.isTypeLambda &&
         node instanceof Lambda &&
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
         const lambdaType = new LambdaType(paramTypes, returnType, true);
         return lambdaType;
      } else {
         const returnType = this.infer(node.block, innerScope);
         const lambdaType = new LambdaType(paramTypes, returnType);
         return lambdaType;
      }
   }

   resolvedGeneric(type: AppliedGenericType, scope: Scope): Type {
      let callee = type.callee;
      if (callee instanceof Identifier) {
         callee = scope.lookupType(callee.value);
      }
      if (callee && callee instanceof LambdaType) {
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
      throw new Error("Could not resolve generic type");
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
                  return type;
               }
            } else {
               return type;
            }
         case "GenericNamedType":
            if (type.name && Object.keys(parameters).includes(type.name)) {
               const name = parameters[type.name];
               if (name.tag && name instanceof Identifier) {
                  return new NamedType(name.value);
               } else {
                  return type;
               }
            } else {
               return type;
            }
         case "AppliedGenericType":
            return type;
         case "LambdaType":
            const lambdaType = type as LambdaType;
            const resolvedParams = lambdaType.paramTypes.map((pt) => {
               return this.resolveGenericTypes(pt, parameters);
            });
            const returnType = this.resolveGenericTypes(
               lambdaType.returnType,
               parameters
            );
            const result = new LambdaType(resolvedParams, returnType);
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
         case "Assignment":
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
         case "LambdaType":
            if (!(node instanceof LambdaType)) {
               throw Error("Not right type");
            }
            return node;
         case "Lambda":
            // return new LambdaType(node.params.map(p => this.translateTypeNodeToType(p, scope/)))
            if (!(node instanceof Lambda)) {
               throw new Error("Weird type");
            }
            const innerScope = scope.innerScopeOf(node);
            innerScope.run = this.run;
            innerScope.declareType("T", new NamedType("T"));
            return new LambdaType(
               node.params.map((p) =>
                  this.translateTypeNodeToType(p, innerScope)
               ),
               this.translateTypeNodeToType(
                  node.block.statements[0],
                  innerScope
               ),
               node.isTypeLambda
            );
         case "TypeDef":
            if (!(node instanceof TypeDef)) {
               return new Type();
            }
            const fieldTypes = node.fieldDefs.map((f) => {
               return new Symbol(
                  f.name,
                  this.translateTypeNodeToType(f.type, scope),
                  f
               );
               // return { name: f.name, type: new NamedType(f.type) }
            });
            return new StructType(fieldTypes);
         case "Apply":
            if (!(node instanceof Apply)) {
               return new Type();
            }
            if (node.isTypeLambda) {
               const applied = new AppliedGenericType(
                  this.translateTypeNodeToType(node.callee, scope),
                  node.args.map((arg) =>
                     this.translateTypeNodeToType(arg, scope)
                  )
               );
               let callee = this.infer(node.callee, scope);
               if (callee instanceof Identifier) {
                  callee = scope.lookupType(callee.value);
               }
               if (callee && callee instanceof LambdaType) {
                  const actualParams = node.args;
                  const expectedParams = callee.paramTypes;
                  let params: { [_: string]: Type } = {};
                  expectedParams.forEach((p, i) => {
                     if (p.name) {
                        params[p.name] = this.infer(actualParams[i], scope);
                     }
                  });
                  const resolved = this.resolveGenericTypes(
                     callee.returnType,
                     params
                  );
                  applied.resolved = resolved;
               }
               return applied;
            }
            throw new Error("Was type apply, but not isTypeLambda. ");
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
            return new Type();
      }
   }

   typeCheck(node: AstNode, scope: Scope) {
      if (node instanceof Block) {
         node.statements.forEach((c) => this.typeCheck.bind(this)(c, scope));
      } else if (node instanceof Assignment && node.value) {
         this.typeCheck(node.value, scope);
      } else if (node instanceof Apply) {
         this.typeCheckApply(node, scope);
      }
   }

   typeCheckApply(apply: Apply, scope: Scope) {
      let symbol =
         apply.callee instanceof Identifier
            ? scope.lookup(apply.callee.value)
            : this.infer(apply.callee, scope);
      // If a Type-Value Lambda [T] => value
      if (apply.isTypeLambda) {
         const applyType = this.infer(apply, scope);
         const callee = this.infer(apply.callee, scope);
         apply.args.forEach((arg) => {
            const translatedType = this.translateTypeNodeToType(arg, scope);
         });
         return;
      }

      if (symbol instanceof Symbol && symbol.typeSymbol instanceof LambdaType) {
         const params = symbol.typeSymbol.paramTypes;
         if (
            params[0] &&
            params[0] instanceof AppliedGenericType &&
            params[0].callee.name === "Array"
         ) {
            const expectedType = params[0].parameterTypes[0];
            apply.args.forEach((p, i) => {
               const gottenType = this.infer(p, scope);
               if (!gottenType.isAssignableTo(expectedType)) {
                  this.errors.add(
                     `Parameter ${i} of ${
                        apply.callee instanceof Identifier
                           ? apply.callee.value
                           : "Anonymous function"
                     } (${apply.isTypeLambda ? "Type" : "Values"})`,
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
               if (!(symbol.typeSymbol instanceof LambdaType)) {
                  return;
               }
               const type = this.infer(p, scope);
               if (!type.isAssignableTo(symbol.typeSymbol.paramTypes[i])) {
                  this.errors.add(
                     `Parameter ${i} of ${
                        apply.callee instanceof Identifier
                           ? apply.callee.value
                           : "Anonymous function"
                     } (${apply.isTypeLambda ? "Type" : "Values"})`,
                     symbol.typeSymbol.paramTypes[i],
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
            new LambdaType(
               [NamedType.PRIMITIVE_TYPES.Any],
               NamedType.PRIMITIVE_TYPES.Void
            ),
            new Lambda([], new Block([]))
         )
      );
      const innerArrayScope = new Scope("inner-array", languageScope);
      innerArrayScope.declareType("T", new GenericNamedType("T"));
      const arrayStruct = new StructType([
         new Symbol(
            "length",
            new LambdaType([], languageScope.lookupType("Number"))
         ),
      ]);
      languageScope.declareType(
         "Array",
         new LambdaType([new GenericNamedType("T")], arrayStruct, true)
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

   // Walk through the AST and infer types for definitions
   build(node: AstNode, scope: Scope) {
      if (node instanceof Assignment) {
         this.inferAssignment(node, scope);
      } else if (node instanceof Block) {
         node.statements.forEach((statement) => this.build(statement, scope));
      } else if (node instanceof IfStatement) {
         this.build(node.condition, scope);
         this.build(node.trueBranch, scope);
         if (node.falseBranch) {
            this.build(node.falseBranch, scope);
         }
      }
   }

   inferAssignment(node: Assignment, scope: Scope) {
      const lhs = node.lhs;
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
      const rhsType = this.infer(node.value, scope);
      if (
         node.isTypeLevel &&
         node.lhs instanceof Identifier &&
         node.lhs.value
      ) {
         if (node.value instanceof Lambda && !node.value.isTypeLambda) {
            scope.declareType(node.lhs.value, this.infer(node.value, scope));
         } else {
            scope.declareType(
               node.lhs.value,
               this.translateTypeNodeToType(node.value, scope)
            );
         }
         return;
      }
      if (!(lhs instanceof Identifier)) {
         throw new Error("LHS was not Identifier");
      }
      let symbol = new Symbol(lhs.value, rhsType, node);
      if (!node.type) {
         scope.mapAst(node, rhsType ? rhsType : new Type());
         // node.type = rhsType ? rhsType : new Type();
      } else if (
         !rhsType.isAssignableTo(this.translateTypeNodeToType(node.type, scope))
      ) {
         this.errors.add(
            `Assignment of ${
               node.lhs instanceof Identifier ? node.lhs.value : "term"
            }`,
            this.translateTypeNodeToType(node.type, scope),
            rhsType,
            node.position,
            new Error()
         );
      }
      if (node.isDeclaration) {
         // if (rhsType instanceof StructType) {
         //    scope.declareType(
         //       lhs.value,
         //       this.translateTypeNodeToType(node.value, scope).located(
         //          node.position,
         //          node.position
         //       )
         //    );
         // } else {

         symbol = symbol.located(node.position, node.position);
         scope.declare(lhs.value, symbol);
         node.symbol = symbol;
         // }
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
