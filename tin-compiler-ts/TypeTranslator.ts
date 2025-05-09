import {
   AstNode,
   Literal,
   Assignment,
   UnaryOperator,
   RoundValueToValueLambda,
   SquareTypeToTypeLambda,
   TypeDef,
   Call,
   BinaryExpression,
   Optional,
   Group,
   Term,
   SquareTypeToValueLambda,
   Block,
   Tuple,
   Select,
} from "./Parser";
import {
   TypePhaseContext,
   Scope,
   Symbol,
   RecursiveResolutionOptions,
} from "./Scope";
import {
   ParamType,
   SquareTypeToValueLambdaType,
   ThisType,
   RefinedType,
   Nothing,
   PrimitiveType,
   NotType,
   Never,
} from "./Types";
import { Identifier, RefinedDef } from "./Parser";
import { Any, MutableType, UnionType, IntersectionType } from "./Types";
import {
   Type,
   NamedType,
   LiteralType,
   GenericNamedType,
   VarargsType,
   RoundValueToValueLambdaType,
   SquareTypeToTypeLambdaType,
   AppliedGenericType,
   MarkerType,
   StructType,
   OptionalType,
} from "./Types";

// Handles translation of AST nodes to Types
// This does not "infer" the type of the node,
// but rather converts it to a type directly
export class TypeTranslator {
   context: TypePhaseContext;
   constructor(context: TypePhaseContext) {
      this.context = context;
   }

   translate(node: Term, scope: Scope): Type {
      const translatedType = this.translateRaw(node, scope);
      node.translatedType = translatedType;
      translatedType.ast = node;
      return translatedType;
   }

   translateRaw(node: Term, scope: Scope): Type {
      switch (node.tag) {
         case "Identifier":
            if ((node as Identifier).value === "This") {
               return new ThisType();
            }
            if ((node as Identifier).value === "Anything") {
               return Any;
            }
            if ((node as Identifier).value === "Nothing") {
               return Nothing;
            }
            if ((node as Identifier).value === "Never") {
               return Never;
            }
            if ((node as Identifier).value === "Boolean") {
               return PrimitiveType.Boolean;
            }
            if ((node as Identifier).value === "String") {
               return PrimitiveType.String;
            }
            if ((node as Identifier).value === "Number") {
               return PrimitiveType.Number;
            }

            return new NamedType((node as Identifier).value);
         case "Literal":
            const literal = node as Literal;
            let resultType: Type = Any;
            if (literal.type === "Anything" && literal.value === "") {
               return Any;
            }
            if (literal.type === "Void") {
               return Nothing;
            }
            if (literal.type === "String") {
               resultType = PrimitiveType.String;
            }
            if (literal.type === "Number") {
               resultType = PrimitiveType.Number;
            }
            if (literal.type === "Boolean") {
               resultType = PrimitiveType.Boolean;
            }
            return new LiteralType(String(literal.value), resultType);
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
                  ? this.translate(node.type, scope)
                  : undefined;
               return new GenericNamedType(name, extendedType);
            }
            return new Type();
         case "UnaryOperator":
            if (!(node instanceof UnaryOperator)) {
               throw Error("Not right type");
            }
            if (node.operator === "!") {
               return new NotType(this.translate(node.expression, scope));
            } else if (node.operator === "var") {
               return new MutableType(this.translate(node.expression, scope));
            } else {
               throw new Error("Unexpected unary operator");
            }
         case "GenericNamedType":
            if (!(node instanceof GenericNamedType)) {
               throw Error("Not right type");
            }
            return node;
         case "RoundValueToValueLambda":
            if (!(node instanceof RoundValueToValueLambda)) {
               throw new Error("Weird type");
            }
            const innerScope = scope.innerScopeOf(node, true);
            const type = new RoundValueToValueLambdaType(
               node.params.map((p) =>
                  this.translateRoundTypeToTypeLambdaParameter(
                     p,
                     innerScope,
                     {}
                  )
               ),
               this.translate(node.block.statements[0], innerScope),
               node.isTypeLambda === true,
               node.pure,
               node.capturesMutableValues
            );
            if (
               node.params.length > 0 &&
               node.params[0] instanceof Assignment &&
               node.params[0].lhs instanceof Identifier &&
               node.params[0].lhs.value === "self"
            ) {
               type.isFirstParamThis = true;
            }
            return type;
         case "SquareTypeToTypeLambda":
            if (!(node instanceof SquareTypeToTypeLambda)) {
               throw new Error("Weird type");
            }
            const innerScope2 = scope.innerScopeOf(node, true);
            const genericParameters = node.parameterTypes.map((p) => {
               const param = this.translate(p, innerScope2);
               if (param instanceof GenericNamedType) {
                  return param;
               } else {
                  throw new Error("Expected Generic parameter, but it wasn't");
               }
            });
            return new SquareTypeToTypeLambdaType(
               genericParameters,
               this.translate(node.returnType, innerScope2)
            );
         case "SquareTypeToValueLambda":
            if (!(node instanceof SquareTypeToValueLambda)) {
               throw new Error("Weird type");
            }
            const innerScopeX = scope.innerScopeOf(node, true);
            const genericParametersX = node.parameterTypes.map((p) => {
               const param = this.translate(p, innerScopeX);
               if (param instanceof GenericNamedType) {
                  return param;
               } else {
                  throw new Error("Expected Generic parameter, but it wasn't");
               }
            });
            return new SquareTypeToValueLambdaType(
               genericParametersX,
               this.translate(node.block, innerScopeX),
               node.pure
            );
         case "Block":
            return this.translate((node as Block).statements[0], scope);
         case "Call":
            if (!(node instanceof Call) || node.kind !== "SQUARE") {
               return new Type();
            }
            return new AppliedGenericType(
               this.translate(node.callee, scope),
               node.args.map(([name, arg]) => this.translate(arg, scope))
            );
         case "TypeDef":
            if (!(node instanceof TypeDef)) {
               return new Type();
            }
            if (node.fieldDefs.length === 0) {
               return new MarkerType();
            }
            const veryInnerScope = scope.innerScopeOf(node, true);
            const fieldTypes = node.fieldDefs.map((f) => {
               let fieldType: Type;
               if (f.type) {
                  fieldType = this.translate(f.type, veryInnerScope);
               } else if (f.defaultValue) {
                  fieldType = this.context.inferencer.infer(
                     f.defaultValue,
                     veryInnerScope
                  );
               } else {
                  fieldType = new Type();
               }
               return new ParamType(
                  fieldType,
                  f.name,
                  f.defaultValue,
                  f.type instanceof MutableType
               );
            });
            return new StructType(node.name, fieldTypes);
         case "Call":
            if (!(node instanceof Call)) {
               return new Type();
            }
            throw new Error(
               "Was type apply, but not isTypeRoundValueToValueLambda. got " +
                  node.tag
            );
         case "BinaryExpression":
            if (!(node instanceof BinaryExpression)) {
               return new Type();
            }
            const left = this.translate(node.left, scope);
            if (node.operator === "where") {
               const right = this.context.inferencer.infer;

               return new RefinedType(left);
            }

            const right = this.translate(node.right, scope);
            if (node.operator === "|") {
               return new UnionType(left, right);
            } else if (node.operator === "&") {
               return new IntersectionType(left, right);
            }
            this.context.errors.add(
               `Type operation '${node.operator}' not supported`,
               undefined,
               undefined,
               node.position
            );
            return Any;
         case "Optional":
            if (!(node instanceof Optional)) {
               return new Type();
            }
            return new OptionalType(this.translate(node.expression, scope));
         case "Group":
            if (node instanceof Group) {
               return this.translate(node.value, scope);
            }
         case "Tuple":
            if (node instanceof Tuple) {
               node.isTypeLevel = true;
               return new AppliedGenericType(
                  new NamedType("Tuple" + node.expressions.length),
                  node.expressions.map((el) => this.translate(el, scope))
               );
            }
         case "RefinedDef":
            if (node instanceof RefinedDef) {
               const lambdaType = this.context.inferencer.infer(
                  node.lambda,
                  scope
               );
               if (lambdaType instanceof RoundValueToValueLambdaType) {
                  return new RefinedType(lambdaType.params[0].type);
               }
            }
         case "Select":
            if (node instanceof Select) {
               const asName = node.nameAsSelectOfIdentifiers();
               if (asName !== undefined) {
                  return scope.lookupType(asName).typeSymbol;
               }
            }
         default:
            throw new Error(
               "Could not translate " +
                  node.tag +
                  " " +
                  node.show() +
                  " " +
                  node.position +
                  ". At " +
                  node.position?.start.line
            );
      }
   }

   translateRoundTypeToTypeLambdaParameter(
      node: Term,
      scope: Scope,
      options: RecursiveResolutionOptions
   ): ParamType {
      if (node instanceof Identifier && node.isTypeLevel) {
         const explicitType = this.translate(node, scope);
         return new ParamType(explicitType);
      }
      if (node instanceof Assignment && node.lhs instanceof Identifier) {
         if (node.lhs instanceof Identifier && node.isTypeLevel) {
            node.type = node.lhs;
            return new ParamType(this.translate(node, scope));
         }
         let explicitType;
         if (node.type) {
            explicitType = this.translate(node.type, scope);
         }
         if (!node.type && !node.value && !options?.typeExpectedInPlace) {
            explicitType = Any;
            // throw new Error(
            //    "Cannot deduce type from typeless, valueless parameter."
            // );
         }
         let inferredType;
         if (node.value) {
            inferredType = this.context.inferencer.infer(
               node.value,
               scope,
               options
            );
         }
         const name = node.lhs.value;
         const value = node.value;

         let type: Type = Any;
         if (explicitType && inferredType) {
            // Check if inferred extends explicit
            if (!inferredType.isAssignableTo(explicitType, scope)) {
               this.context.errors.add(
                  `Default value of parameter ${
                     node.lhs instanceof Identifier ? node.lhs.value : "term"
                  }`,
                  explicitType,
                  inferredType,
                  node.position,
                  undefined,
                  new Error()
               );
            }
            type = explicitType;
         } else if (explicitType) {
            type = explicitType;
         } else if (inferredType) {
            type = inferredType;
            if (type instanceof LiteralType) {
               type = type.type;
            }
         }
         return new ParamType(type, name, value);
      }
      const translatedAsType = this.translate(node, scope);
      if (translatedAsType) {
         return new ParamType(translatedAsType);
      }
      throw new Error("Term wasn't Assignment, but " + node.tag);
   }
}
