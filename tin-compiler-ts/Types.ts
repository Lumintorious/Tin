import { TokenPos } from "./Lexer";
import {
   AstNode,
   Term,
   TypeDef,
   PotentialTypeArgs,
   RoundValueToValueLambda,
   BinaryExpression,
   Select,
} from "./Parser";
import { GenericTypeMap, Scope, Symbol, TypePhaseContext } from "./Scope";
import { Identifier, Literal } from "./Parser";

export class Type {
   tag: string;
   name?: string;
   position?: TokenPos;
   ast?: AstNode;
   isForwardReferenceable: boolean = false;
   run?: number;
   index?: number;
   appliedTypeArgs: Type[] = [];
   constructor(tag: string = "Unknown") {
      this.tag = tag;
      if (tag === "Unknown") {
         throw new Error("Abstract Type initialization");
      }
   }

   isMutable(): boolean {
      return false;
   }

   buildConstructor(
      scope?: Scope,
      context?: TypePhaseContext
   ): Type | undefined {
      return undefined;
   }

   named(name: string): this {
      this.name = name;
      return this;
   }

   isAssignableTo(other: Type, scope: Scope) {
      if (!other) {
         throw new Error("Found undefined type");
      }
      if (other instanceof AnyType) {
         return true;
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

   static walkTypes(root: Type, fn: (type: Type) => Type | undefined) {
      const result = fn(root);
      if (result instanceof Type) return result;
      else return root;
   }
}

export class UncheckedType extends Type {
   constructor() {
      super("Unchecked");
   }

   isAssignableTo(other: Type, scope: Scope): boolean {
      return false;
   }

   extends(other: Type, scope: Scope): boolean {
      return false;
   }

   isExtendedBy(other: Type, scope: Scope): boolean {
      return false;
   }

   toString(): string {
      return "Unchecked";
   }
}

export class AnyType extends Type {
   constructor() {
      super("Anything");
      this.name = "Anything";
   }

   isAssignableTo(other: Type): boolean {
      return !(other instanceof MutableType);
   }

   extends(other: Type) {
      return other instanceof AnyType;
   }

   isExtendedBy(other: Type) {
      return !(other instanceof MutableType);
   }

   toString() {
      return "Anything";
   }
}

export const Any = new AnyType();

export class PrimitiveType extends Type {
   static Number = new PrimitiveType("Number");
   static String = new PrimitiveType("String");
   static Boolean = new PrimitiveType("Boolean");
   static Ok = new PrimitiveType("Ok");
   static Type = new PrimitiveType("Type");

   name: string;
   constructor(name: string) {
      super("PrimitiveType");
      this.name = name;
   }

   extends(other: Type): boolean {
      return (
         this === other ||
         (this === PrimitiveType.String && other.name === "InterpolatedString")
      );
   }

   isExtendedBy(other: Type): boolean {
      return this === other;
   }

   toString(): string {
      return this.name;
   }
}

export class NothingType extends Type {
   constructor() {
      super("Nothing");
   }

   extends(other: Type): boolean {
      return other instanceof NothingType;
   }

   isExtendedBy(other: Type): boolean {
      return other instanceof NothingType;
   }

   toString(): string {
      return "Nothing";
   }
}

export const Nothing = new NothingType();

export class NeverType extends Type {
   constructor() {
      super("Never");
   }

   extends(other: Type): boolean {
      return other instanceof NeverType;
   }

   isExtendedBy(other: Type): boolean {
      return other instanceof NeverType;
   }

   toString(): string {
      return "Never";
   }
}

export const Never = new NeverType();

export class ThisType extends Type {
   constructor() {
      super("This");
   }

   toString(): string {
      return "This";
   }
}

export class TypeOfTypes extends Type {
   constructor() {
      super("TypeOfTypes");
   }

   toString(): string {
      return "TypeOfTypes";
   }
}

export class NamedType extends Type {
   name: string;
   constructor(name: string) {
      super("NamedType");
      this.name = name;
   }

   isAssignableTo(other: Type, scope: Scope): boolean {
      const realType = scope.lookupType(this.name);
      if (
         (other instanceof NamedType || other instanceof GenericNamedType) &&
         this.name === other.name &&
         realType !== undefined
      ) {
         return true;
      }
      if (realType.typeSymbol instanceof NamedType) {
         if (super.isAssignableTo(other, scope)) {
            return true;
         }
         return false;
      }
      realType.typeSymbol.name = this.name;
      return realType.typeSymbol.isAssignableTo(other, scope);
   }

   extends(other: Type, scope: Scope) {
      // Named types are assignable if they are equal (same name)
      return other instanceof NamedType && this.name === other.name;
   }

   isExtendedBy(other: Type, scope: Scope) {
      let realType = scope.lookupType(this.name).typeSymbol;
      return (
         (other instanceof NamedType && this.name === other.name) ||
         (other.name !== undefined && other.name === this.name) ||
         (realType ? realType.isExtendedBy(other, scope) : false)
      );
   }

   toString() {
      return this.name;
   }
}

export class ModuleType extends Type {
   scope: Scope;
   constructor(scope: Scope) {
      super("ModuleType");
      this.scope = scope;
   }

   extends(other: Type, scope: Scope): boolean {
      return false;
   }

   isExtendedBy(other: Type, scope: Scope): boolean {
      return false;
   }
}

export class SingletonType extends Type {
   value: string | Symbol;
   type: Type;
   select?: Select;
   constructor(value: string | Symbol, type: Type, select?: Select) {
      super("SingletonType");
      this.value = value;
      this.type = type;
      if (type instanceof SingletonType) {
         this.type = type.type;
      }
      this.select = select;
   }

   isAssignableTo(other: Type, scope: Scope): boolean {
      if (other instanceof AnyType) {
         return true;
      }
      return this.extends(other, scope) || other.isExtendedBy(this, scope);
   }

   extends(other: Type, scope: Scope) {
      if (other instanceof AnyType) {
         return true;
      }

      if (
         other instanceof SingletonType &&
         this.type.extends(other.type, scope) &&
         (other.value === this.value ||
            (other.value instanceof Symbol &&
               this.value instanceof Symbol &&
               other.value.name === this.value.name))
      ) {
         return true;
      }

      return this.type.isAssignableTo(other, scope);
   }

   isExtendedBy(other: Type, scope: Scope): boolean {
      console.log(
         "Checking isExtendedBy for SingletonType: " + this + " - " + other
      );
      return (
         other instanceof SingletonType &&
         other.type.isExtendedBy(this.type, scope) &&
         (other.value === this.value ||
            (other.value instanceof Symbol &&
               this.value instanceof Symbol &&
               other.value.name === this.value.name))
      );
   }

   toString() {
      let result = "";
      if (this.select) {
         result = this.select.show();
      } else if (this.value instanceof Symbol) {
         result = this.name ?? this.value.name;
      } else if (this.type.name === "String") {
         result = `"${this.value}"`;
      } else {
         result = this.value;
      }

      return `${result} (${this.type.toString()})`;
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

   extends(other: Type, scope: Scope): boolean {
      // Named types are assignable if they are equal (same name)
      return (
         ((other instanceof NamedType || other instanceof GenericNamedType) &&
            this.name === other.name) ||
         (this.extendedType != undefined &&
            this.extendedType.extends(other, scope))
      );
   }

   isExtendedBy(other: Type, scope: Scope): boolean {
      return (
         ((other instanceof NamedType || other instanceof GenericNamedType) &&
            this.name === other.name) ||
         (this.extendedType != undefined &&
            this.extendedType.isExtendedBy(other, scope))
      );
   }

   toString() {
      return (
         this.name +
         (this.extendedType ? ": " + this.extendedType.toString() : "")
      );
   }
}

export class MutableType extends Type {
   type: Type;
   constructor(type: Type) {
      super("MutableType");
      if (type instanceof MutableType) {
         this.type = type.type;
      } else {
         this.type = type;
      }
      if (!type) {
         throw new Error("What?");
      }
   }

   isMutable(): boolean {
      return true;
   }

   isAssignableTo(other: Type, scope: Scope): boolean {
      return (
         super.isAssignableTo(other, scope) ||
         this.type.isAssignableTo(other, scope)
      );
   }

   extends(other: Type, scope: Scope): boolean {
      return (
         (other instanceof MutableType &&
            this.type.extends(other.type, scope)) ||
         this.type.extends(other, scope)
      );
   }

   isExtendedBy(other: Type, scope: Scope): boolean {
      return (
         (other instanceof MutableType &&
            this.type.isExtendedBy(other.type, scope)) ||
         this.type.isExtendedBy(other, scope)
      );
   }

   toString(): string {
      return "var " + this.type.toString();
   }
}

export class OptionalType extends Type {
   type: Type;
   constructor(type: Type) {
      super("OptionalType");
      if (type instanceof OptionalType) {
         this.type = type.type;
      } else {
         this.type = type;
      }
   }

   isSame(other: OptionalType, scope: Scope): boolean {
      return this.type.isAssignableTo(other.type, scope);
   }

   extends(other: Type, scope: Scope): boolean {
      if (other instanceof OptionalType && this.isSame(other, scope)) {
         return true;
      }
      return (
         this.type.isAssignableTo(other, scope) ||
         other.isAssignableTo(new NamedType("Error"), scope)
      );
   }

   isExtendedBy(other: Type, scope: Scope) {
      if (other instanceof OptionalType && this.isSame(other, scope)) {
         return true;
      }
      console.log(
         "Checking isExtendedBy for OptionalType: " + this + " - " + other
      );
      return (
         other.isAssignableTo(this.type, scope) ||
         new NamedType("Error").isAssignableTo(other, scope)
      );
   }

   toString() {
      return "(" + this.type.toString() + ")?";
   }
}

export class ParamType {
   type: Type;
   name?: string;
   defaultValue?: Term;
   parentComponent?: Type;
   mutable: boolean = false;
   constructor(
      type: Type,
      name?: string,
      defaultValue?: Term,
      mutable: boolean = false
   ) {
      this.type = type;
      this.name = name;
      this.defaultValue = defaultValue;
      this.mutable = mutable;
   }

   toString() {
      return `${this.name ? this.name + ": " : ""}${this.type}`;
   }
}

// Type of a RoundValueToValueLambda: (Int) -> String
export class RoundValueToValueLambdaType extends Type {
   params: ParamType[];
   returnType: Type;
   isFirstParamThis: boolean = false;
   pure: boolean;
   capturesMutableValues: boolean;
   isConstructor?: boolean;
   constructor(
      params: ParamType[],
      returnType: Type,
      isGeneric: boolean,
      pure: boolean,
      capturesMutableValues: boolean = false
   ) {
      super("RoundValueToValueLambdaType");
      for (let param of params) {
         if (!(param instanceof ParamType)) {
            throw new Error("HERE " + JSON.stringify(param));
         }
      }
      this.params = params;
      this.returnType = returnType;
      this.isForwardReferenceable = true;
      this.pure = pure;
      this.capturesMutableValues = capturesMutableValues;
   }

   isMutable(): boolean {
      return this.returnType.isMutable();
   }

   extends(other: Type, scope: Scope) {
      if (!(other instanceof RoundValueToValueLambdaType)) return false;
      if (other.params.length !== this.params.length) return false;
      // Check if parameter types are contravariant
      const paramCheck =
         this.params.length === other.params.length &&
         this.params.every((param, index) => {
            if (
               param.defaultValue &&
               other.params[index].type instanceof OptionalType
            ) {
               return other.params[index].type.type.isAssignableTo(
                  param.type,
                  scope
               );
            }
            return other.params[index].type.isAssignableTo(param.type, scope);
         });

      // Return type must be covariant
      const returnCheck =
         other.returnType === Nothing ||
         this.returnType.isAssignableTo(other.returnType, scope);

      const purityCheck = other.pure ? this.pure : true;
      const captureCheck = !other.capturesMutableValues
         ? !this.capturesMutableValues
         : true;

      const varCheck = !(this.returnType instanceof MutableType)
         ? !(other.returnType instanceof MutableType)
         : true;
      //   const varCheck =
      //      !(other.returnType instanceof MutableType) ===
      //      !(this.returnType instanceof MutableType);

      return (
         paramCheck && returnCheck && purityCheck && captureCheck && varCheck
      );
   }

   isExtendedBy(other: Type, scope: Scope): boolean {
      return (
         other instanceof RoundValueToValueLambdaType &&
         other.extends(this, scope)
      );
   }

   toString() {
      const paramsStr = this.params
         .map((t) => `${t.name ? t.name + ":" : ""}${t.type.toString()}`)
         .join(", ");
      return `(${paramsStr}) ${this.capturesMutableValues ? "~" : ""}${
         this.pure ? "->" : "~>"
      } ${this.returnType ? this.returnType.toString() : "undefined"}`;
   }
}

export class SquareTypeToValueLambdaType extends Type {
   paramTypes: GenericNamedType[];
   returnType: Type;
   pure: boolean;
   capturesMutableValues: boolean;
   constructor(
      paramTypes: GenericNamedType[],
      returnType: Type,
      pure: boolean,
      capturesMutableValues: boolean = false
   ) {
      super("SquareTypeToValueLambdaType");
      this.paramTypes = paramTypes;
      this.returnType = returnType;
      this.pure = pure;
      this.capturesMutableValues = capturesMutableValues;
   }

   extends(other: Type, scope: Scope): boolean {
      if (!(other instanceof SquareTypeToValueLambdaType)) return false;
      if (other.paramTypes.length !== this.paramTypes.length) return false;
      // Check if parameter types are contravariant
      const paramCheck =
         this.paramTypes.length === other.paramTypes.length &&
         this.paramTypes.every((param, index) => {
            return other.paramTypes[index].name === param.name;
         });

      const syntheticScope = new Scope("syntheticSquareLambdaChecker", scope);
      for (const param of this.paramTypes) {
         syntheticScope.declareType(new Symbol(param.name, param));
      }
      // Return type must be covariant
      const returnCheck = this.returnType.isAssignableTo(
         other.returnType,
         syntheticScope
      );

      const purityCheck = other.pure ? this.pure : true;
      const captureCheck = !other.capturesMutableValues
         ? !this.capturesMutableValues
         : true;

      const varCheck = !(this.returnType instanceof MutableType)
         ? !(other.returnType instanceof MutableType)
         : true;
      //   const varCheck =
      //      !(other.returnType instanceof MutableType) ===
      //      !(this.returnType instanceof MutableType);

      return (
         paramCheck && returnCheck && purityCheck && captureCheck && varCheck
      );
   }

   isMutable(): boolean {
      return this.capturesMutableValues || this.returnType.isMutable();
   }

   toString(): string {
      return `[${this.paramTypes.map((p) => p.toString()).join(", ")}] ${
         this.pure ? "->" : "~>"
      } ${this.returnType.toString()}`;
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

   extends(other: Type, scope: Scope): boolean {
      if (!(other instanceof SquareTypeToTypeLambdaType)) return false;
      if (other.paramTypes.length !== this.paramTypes.length) return false;
      // Check if parameter types are contravariant
      const paramCheck =
         this.paramTypes.length === other.paramTypes.length &&
         this.paramTypes.every((param, index) => {
            return other.paramTypes[index].isAssignableTo(param, scope);
         });

      // Return type must be covariant
      const returnCheck = this.returnType.isAssignableTo(
         other.returnType,
         scope
      );

      return paramCheck && returnCheck;
   }

   isExtendedBy(other: Type, scope: Scope): boolean {
      return (
         other instanceof SquareTypeToTypeLambdaType &&
         other.extends(this, scope)
      );
   }

   buildConstructor(): Type | undefined {
      if (!(this.returnType instanceof StructType) || !this.name) {
         return;
      }
      const constructor = new SquareTypeToValueLambdaType(
         this.paramTypes,
         new RoundValueToValueLambdaType(
            this.returnType.fields,
            new AppliedGenericType(new NamedType(this.name), this.paramTypes),
            false,
            true
         ),
         true
      );
      (constructor.returnType as RoundValueToValueLambdaType).isConstructor =
         true;

      return constructor;
   }

   toString(): string {
      return `[${this.paramTypes
         .map((p) => p.toString())
         .join(", ")}] => ${this.returnType.toString()}`;
   }
}

export class AppliedGenericType extends Type implements PotentialTypeArgs {
   callee: Type;
   parameterTypes: Type[];
   resolved?: Type;
   constructor(callee: Type, parameterTypes: Type[]) {
      super("AppliedGenericType");
      this.callee = callee;
      this.parameterTypes = parameterTypes;
      if (callee.name) {
         this.name = callee.name;
      }
   }

   extends(other: Type, scope: Scope) {
      if (!this.resolved) {
         this.resolved = scope.resolveAppliedGenericTypes(this);
      }
      if (this.resolved && this.resolved !== this) {
         return this.resolved.extends(other, scope);
      } else if (other instanceof AppliedGenericType) {
         if (
            this.resolved !== this &&
            scope
               .resolveAppliedGenericTypes(this)
               .extends(scope.resolveAppliedGenericTypes(other), scope)
         ) {
            return true;
         }
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
      if (!this.resolved) {
         this.resolved = scope.resolveAppliedGenericTypes(this);
      }
      if (
         other instanceof AppliedGenericType &&
         this.callee.name === other.callee?.name &&
         this.callee.name !== undefined &&
         scope.lookupType(this.callee.name) !== undefined
      ) {
         let areAllParamsEqual = true;
         if (this.parameterTypes.length !== other.parameterTypes.length) {
            areAllParamsEqual = false;
         } else {
            for (let i = 0; i < this.parameterTypes.length; i++) {
               if (
                  !other.parameterTypes[i].isAssignableTo(
                     this.parameterTypes[i],
                     scope
                  )
               ) {
                  areAllParamsEqual = false;
                  break;
               }
            }
         }
         return areAllParamsEqual;
      } else if (this.resolved) {
         return other.isAssignableTo(this.resolved, scope);
      } else {
         return false;
      }
   }

   getTypeArgs(): GenericTypeMap | undefined {
      if (!(this.callee instanceof SquareTypeToTypeLambdaType)) {
         return undefined;
      }
      const calledArgs = this.parameterTypes;
      const expectedArgs = this.callee.paramTypes;
      const map = new GenericTypeMap();
      for (let i = 0; i < calledArgs.length; i++) {
         map.set(expectedArgs[i].name, calledArgs[i]);
      }

      return map;
   }

   initTypeArgs(map: GenericTypeMap): void {}

   toString() {
      const paramsStr = this.parameterTypes.map((t) => t.toString()).join(", ");
      if (this.callee instanceof NamedType) {
         if (this.callee.name === "Tuple2" || this.callee.name === "Tuple3") {
            return `(${paramsStr})`;
         }
      }
      return `${
         this.callee.name ?? `{${this.callee.toString()}}`
      }[${paramsStr}]`;
   }
}

export class NotType extends Type {
   type: Type;
   constructor(type: Type) {
      super("NotType");
      this.type = type;
   }

   isExtendedBy(other: Type, scope: Scope): boolean {
      return !this.type.isExtendedBy(other, scope);
   }

   toString(): string {
      return "!(" + this.type.toString() + ")";
   }
}

export class UnionType extends Type {
   left: Type;
   right: Type;
   constructor(left: Type, right: Type, simplify = true) {
      super("UnionType");
      this.left = left;
      this.right = right;
   }

   getAllSeparateUnionedTypes(): Type[] {
      return [
         ...(this.left instanceof UnionType
            ? this.left.getAllSeparateUnionedTypes()
            : [this.left]),
         ...(this.right instanceof UnionType
            ? this.right.getAllSeparateUnionedTypes()
            : [this.right]),
      ];
   }

   static ofAll(types: Type[]) {
      if (types.length === 0) {
         return Nothing;
      } else if (types.length === 1) {
         return types[0];
      } else {
         let type = new UnionType(types[0], types[1]);
         for (let i = 2; i < types.length; i++) {
            type = new UnionType(type, types[i]);
         }
         return type;
      }
   }

   isExtendedBy(other: Type, scope: Scope): boolean {
      if (other instanceof UnionType) {
         return (
            this.left.isAssignableTo(other.left, scope) ||
            this.right.isAssignableTo(other.right, scope) ||
            this.left.isAssignableTo(other.right, scope) ||
            this.right.isAssignableTo(other.left, scope)
         );
      } else {
         return (
            other.isAssignableTo(this.left, scope) ||
            other.isAssignableTo(this.right, scope)
         );
      }
   }

   toString(): string {
      return `(${this.left.toString()} | ${this.right.toString()})`;
   }
}

export class IntersectionType extends Type {
   left: Type;
   right: Type;
   constructor(left: Type, right: Type, simplify = true) {
      super("IntersectionType");
      this.left = left;
      this.right = right;
   }

   extends(other: Type, scope: Scope): boolean {
      if (other instanceof IntersectionType) {
         return (
            this.left.isAssignableTo(other.left, scope) ||
            this.right.isAssignableTo(other.right, scope) ||
            this.left.isAssignableTo(other.right, scope) ||
            this.right.isAssignableTo(other.left, scope)
         );
      } else {
         return (
            this.left.isAssignableTo(other, scope) ||
            this.right.isAssignableTo(other, scope)
         );
      }
   }

   buildConstructor(): Type | undefined {
      const allTypes = [...this.getAllIntersectedTypes()];
      const lastType = allTypes[allTypes.length - 1];
      if (!(lastType instanceof StructType)) {
         return;
      }
      lastType.name = this.name;
      const constructor = lastType.buildConstructor();
      if (!(constructor instanceof RoundValueToValueLambdaType)) {
         return;
      }
      constructor.name = this.name;
      (lastType.ast as TypeDef).name = this.name;
      const expectedType = this.getAllTypesIntersected(
         allTypes.slice(0, allTypes.length - 1)
      );
      constructor.params = [
         new ParamType(expectedType, "self"),
         ...constructor.params,
      ];
      constructor.isConstructor = true;
      return constructor;
   }

   getAllTypesIntersected(types: Type[]): Type {
      types = [...types];
      if (types.length === 0) {
         throw new Error("Attempted to unite a list of 0 types.");
      } else if (types.length === 1) {
         return types[0];
      } else {
         const leftType = types[0];
         types.shift();
         return new IntersectionType(
            leftType,
            this.getAllTypesIntersected(types)
         );
      }
   }

   getAllIntersectedTypes(): Set<Type> {
      let set = new Set<Type>();
      if (this.left instanceof IntersectionType) {
         set = new Set([...set, ...this.left.getAllIntersectedTypes()]);
      } else {
         set.add(this.left);
      }
      if (this.right instanceof IntersectionType) {
         set = new Set([...set, ...this.right.getAllIntersectedTypes()]);
      } else {
         set.add(this.right);
      }

      return set;
   }

   simplified(): Type {
      let types = this.getAllIntersectedTypes();
      if (types.size === 1) {
         return [...types][0];
      } else if (types.size === 2) {
         return new IntersectionType([...types][0], [...types][1]);
      }
      let type: Type | null = null;
      for (let t of types) {
         if (type === null) {
            type = t;
         } else {
            type = new IntersectionType(type, t, false);
         }
      }
      return type || this;
   }

   isExtendedBy(other: Type, scope: Scope): boolean {
      return (
         other.isAssignableTo(this.left, scope) &&
         other.isAssignableTo(this.right, scope)
      );
   }

   toString(): string {
      return `(${this.left.toString()} & ${this.right.toString()})`;
   }
}

export class MarkerType extends Type {
   constructor() {
      super("MarkerType");
   }

   extends(other: Type): boolean {
      return other instanceof MarkerType && other.name === this.name;
   }

   isExtendedBy(other: Type): boolean {
      return other instanceof AnyType;
   }

   toString(): string {
      return `Marker { ${this.name || "Unknown"} }`;
   }
}

export class RefinedType extends Type {
   inputType: Type;
   lambda: RoundValueToValueLambda;
   constructor(inputType: Type, lambda: RoundValueToValueLambda) {
      super("RefinedType");
      this.inputType = inputType;
      this.lambda = lambda;
      if (this.lambda.block.statements.length === 0) {
         throw new Error(
            "RefinedType must have at least one statement in its lambda block."
         );
      }
      Object.freeze(this.lambda.block.statements);
   }

   buildConstructor(
      scope?: Scope,
      context?: TypePhaseContext
   ): Type | undefined {
      let tpe = this.inputType;
      if (scope && context) {
         tpe = scope.resolveNamedType(tpe);
         const fieldsByType = context.inferencer.getAllKnownFields(this, scope);
         let params: ParamType[] = [];
         if (fieldsByType.size === 1) {
            [...fieldsByType.values()][0].forEach((param) => {
               params.push(param);
            });
         }
         let constructor = tpe.buildConstructor(scope, context);
         if (
            constructor instanceof RoundValueToValueLambdaType &&
            this.inputType.isAssignableTo(constructor.returnType, scope)
         ) {
            constructor = new RoundValueToValueLambdaType(
               params,
               this,
               false,
               true,
               false
            );
         }
         return constructor;
      }
   }

   extends(other: Type, scope: Scope): boolean {
      return (
         (other instanceof Type && this.name === other.name) ||
         this.inputType.extends(other, scope)
      );
   }

   isExtendedBy(other: Type, scope: Scope): boolean {
      other = scope.resolveNamedType(other);
      if (
         other instanceof SingletonType &&
         other.type == PrimitiveType.String &&
         this.appliedTypeArgs[0] instanceof SingletonType &&
         this.appliedTypeArgs[0].type === PrimitiveType.String
      ) {
         return (
            String(other.value).match(`^${this.appliedTypeArgs[0].value}$`) !==
            null
         );
      }
      if (
         other instanceof SingletonType &&
         other.type == PrimitiveType.Number &&
         this.lambda.block.statements.length === 1
      ) {
         return this.doesLiteralMatch(
            Number(other.value),
            this.lambda.block.statements[0]
         );
      }
      return other instanceof Type && this.name === other.name;
   }

   doesLiteralMatch(self: number, condition: Term): boolean {
      if (
         condition instanceof BinaryExpression &&
         condition.left instanceof Identifier &&
         condition.left.value === "self" &&
         condition.right instanceof Literal &&
         condition.right.type === "Number"
      ) {
         const right = Number(condition.right.value);
         switch (condition.operator) {
            case ">":
               return self > right;
            case ">=":
               return self >= right;
            case "<":
               return self < right;
            case "<=":
               return self <= right;
            case "==":
               return self == right;
         }
         return false;
      }
      if (
         condition instanceof BinaryExpression &&
         condition.operator === "||"
      ) {
         return (
            this.doesLiteralMatch(self, condition.left) ||
            this.doesLiteralMatch(self, condition.right)
         );
      } else if (
         condition instanceof BinaryExpression &&
         condition.operator === "&&"
      ) {
         return (
            this.doesLiteralMatch(self, condition.left) &&
            this.doesLiteralMatch(self, condition.right)
         );
      }
      return false;
   }

   toString(): string {
      return "refined " + this.name;
   }
}

export class StructType extends Type {
   fields: ParamType[];
   squareParamsApplied?: Type[];
   constructor(name: string | undefined, fields: ParamType[]) {
      super("StructType");
      this.fields = fields; // Array of { name, type } objects
      this.name = name;
   }

   getMutableFields() {
      const values = this.fields.filter((f) => f.type.isMutable());
      const lambdas = this.fields.filter(
         (f) =>
            (f.type instanceof RoundValueToValueLambdaType &&
               !(f.type.returnType instanceof MutableType) &&
               f.type.isMutable()) ||
            (f.type instanceof SquareTypeToValueLambdaType &&
               !(f.type.returnType instanceof MutableType) &&
               f.type.isMutable())
      );
      return [...values, ...lambdas];
   }

   isMutable(): boolean {
      return this.getMutableFields().length > 0;
   }

   buildConstructor(): Type | undefined {
      if (!this.name) {
         return;
      }
      const constructor = new RoundValueToValueLambdaType(
         this.fields,
         new NamedType(this.name),
         false,
         true
      );
      constructor.isConstructor = true;

      return constructor;
   }

   extends(other: Type, scope: Scope) {
      if (other.name === "Anything") return true;
      if (!(other instanceof StructType)) return false;

      // Check if every field in this type exists in the other and is assignable
      const result = this.fields.every((field) => {
         const otherField = other.fields.find((f) => f.name === field.name);
         return otherField && field.type.isAssignableTo(otherField.type, scope);
      });

      return result;
   }

   isExtendedBy(other: Type, scope: Scope) {
      if (!(other instanceof StructType)) return false;

      // Check if every field in this type exists in the other and is assignable
      return this.fields.every((field) => {
         const otherField = other.fields.find((f) => f.name === field.name);
         return (
            otherField !== undefined &&
            field.type.isAssignableTo(otherField.type, scope)
         );
      });
   }

   nameAndAppliedSquareParams(): string {
      return (
         this.name +
         "[" +
         (this.squareParamsApplied ?? []).map((t) => t.name) +
         "]"
      );
   }

   toString() {
      return this.name
         ? this.name
         : `StructType(${this.fields.map(
              (f) => `${f.name}:${f.type.toString()}`
           )})`;
   }
}
