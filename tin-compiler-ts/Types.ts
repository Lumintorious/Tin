import { TokenPos } from "./Lexer";
import { AstNode, Term, RoundValueToValueLambda } from "./Parser";
import { Symbol, Scope } from "./Scope";

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
      if (other instanceof AnyTypeClass) {
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
}

export class UncheckedType extends Type {
   constructor() {
      super("Unchecked");
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

export const AnyType = new AnyTypeClass();

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

   isPrimitive() {
      return Object.keys(NamedType.PRIMITIVE_TYPES).includes(this.name);
   }

   isAssignableTo(other: Type, scope: Scope): boolean {
      if (this.name === "Nothing") {
         return true;
      }
      const realType = scope.lookupType(this.name);
      if (
         (other instanceof NamedType || other instanceof GenericNamedType) &&
         this.name === other.name &&
         realType !== undefined
      ) {
         return true;
      }
      if (realType instanceof NamedType) {
         if (super.isAssignableTo(other, scope)) {
            return true;
         }
         if (
            this.name === other.name &&
            Object.keys(NamedType.PRIMITIVE_TYPES).includes(this.name)
         ) {
            return true;
         }
         return false;
      }
      realType.name = this.name;

      return realType.isAssignableTo(other, scope);
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

export class LiteralType extends Type {
   value: string;
   type: Type;
   constructor(value: string, type: Type) {
      super("LiteralType");
      this.value = value;
      this.type = type;
   }

   extends(other: Type, scope: Scope) {
      if (
         other instanceof LiteralType &&
         this.type.extends(other.type, scope) &&
         this.value === other.value
      ) {
         return true;
      }
      return (
         this.type.extends(other, scope) || other.isExtendedBy(this.type, scope)
      );
   }

   isExtendedBy(other: Type, scope: Scope): boolean {
      return (
         other instanceof LiteralType &&
         other.type.isExtendedBy(this.type, scope) &&
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
      return this.name;
   }
}

export class OptionalType extends Type {
   type: Type;
   constructor(type: Type) {
      super("OptionalType");
      this.type = type;
   }

   isSame(other: OptionalType, scope: Scope): boolean {
      return this.type.isAssignableTo(other.type, scope);
   }

   isExtendedBy(other: Type, scope: Scope) {
      if (other instanceof OptionalType && this.isSame(other, scope)) {
         return true;
      }
      return (
         other.isAssignableTo(this.type, scope) ||
         other === NamedType.PRIMITIVE_TYPES.Nothing
      );
   }

   toString() {
      return this.type.toString() + "?";
   }
}

export class ParamType {
   type: Type;
   name?: string;
   defaultValue?: Term;
   parentComponent?: Type;
   constructor(type: Type, name?: string, defaultValue?: Term) {
      this.type = type;
      this.name = name;
      this.defaultValue = defaultValue;
   }
}

// Type of a RoundValueToValueLambda: (Int) => String
export class RoundValueToValueLambdaType extends Type {
   params: ParamType[];
   returnType: Type;
   isFirstParamThis: boolean = false;
   isGeneric?: boolean;
   constructor(params: ParamType[], returnType: Type, isGeneric?: boolean) {
      super("RoundValueToValueLambdaType");
      for (let param of params) {
         if (!(param instanceof ParamType)) {
            throw new Error("HERE " + JSON.stringify(param));
         }
      }
      this.params = params;
      this.returnType = returnType;
      this.isGeneric = isGeneric;
      this.isForwardReferenceable = true;
   }

   extends(other: Type, scope: Scope) {
      if (!(other instanceof RoundValueToValueLambdaType)) return false;
      // Check if parameter types are contravariant
      const paramCheck =
         this.params.length === other.params.length &&
         this.params.every((param, index) => {
            return other.params[index].type.isAssignableTo(param.type, scope);
         });

      // Return type must be covariant
      const returnCheck =
         other.returnType.name === "Nothing" ||
         this.returnType.isAssignableTo(other.returnType, scope);

      return paramCheck && returnCheck;
   }

   isExtendedBy(other: Type, scope: Scope): boolean {
      return (
         other instanceof RoundValueToValueLambdaType &&
         other.extends(this, scope)
      );
   }

   toString() {
      if (this.name) {
         return this.name;
      }
      const paramsStr = this.params.map((t) => t.type.toString()).join(", ");
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
      if (callee.name) {
         this.name = callee.name;
      }
   }

   extends(other: Type, scope: Scope) {
      if (!this.resolved) {
         this.resolved = scope.resolveAppliedGenericTypes(this);
      }
      if (this.resolved) {
         return this.resolved.extends(other, scope);
      } else if (other instanceof AppliedGenericType) {
         if (
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
         return true;
      } else if (this.resolved) {
         return this.resolved.isAssignableTo(other, scope);
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
      if (super.isAssignableTo(other, scope)) {
         return true;
      }
      if (
         this.operator === "&" &&
         other instanceof BinaryOpType &&
         other.operator === "&"
      ) {
         return (
            (this.left.isAssignableTo(other.left, scope) &&
               this.right.isAssignableTo(other.right, scope)) ||
            (this.right.isAssignableTo(other.left, scope) &&
               this.left.isAssignableTo(other.right, scope))
         );
      } else if (this.operator === "&") {
         return (
            this.left.isAssignableTo(other, scope) ||
            this.right.isAssignableTo(other, scope)
         );
      } else if (
         this.operator === "|" &&
         other instanceof BinaryOpType &&
         other.operator === "|"
      ) {
         return (
            (this.left.extends(other.left, scope) &&
               this.right.extends(other.right, scope)) ||
            (this.right.extends(other.left, scope) &&
               this.left.extends(other.right, scope))
         );
      } else if (this.operator === "|") {
         return (
            this.left.isAssignableTo(other, scope) &&
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
            (this.left.extends(other.left, scope) &&
               this.right.extends(other.right, scope)) ||
            (this.right.extends(other.left, scope) &&
               this.left.extends(other.right, scope))
         );
      } else if (this.operator === "|") {
         return (
            this.left.extends(other, scope) || this.right.extends(other, scope)
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

export class MarkerType extends Type {
   constructor() {
      super("MarkerType");
   }

   extends(other: Type, scope: Scope): boolean {
      return other instanceof MarkerType && other.name === this.name;
   }

   isExtendedBy(other: Type, scope: Scope): boolean {
      return other instanceof AnyTypeClass;
   }

   toString(): string {
      return `Marker { ${this.name || "Unknown"} }`;
   }
}

export class StructType extends Type {
   fields: ParamType[];
   constructor(fields: ParamType[]) {
      super("StructType");
      this.fields = fields; // Array of { name, type } objects
   }

   extends(other: Type, scope: Scope) {
      if (other.name === "Any") return true;
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

   toString() {
      return (
         this.name ??
         `StructType(${this.fields.map(
            (f) => `${f.name}::${f.type.toString()}`
         )})`
      );
   }
}
