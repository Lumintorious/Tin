import {
   AstNode,
   Literal,
   Assignment,
   UnaryOperator,
   RoundTypeToTypeLambda,
   RoundValueToValueLambda,
   SquareTypeToTypeLambda,
   SquareApply,
   TypeDef,
   RoundApply,
   BinaryExpression,
   Optional,
   Group,
   Term,
} from "./Parser";
import { TypePhaseContext, Scope, Symbol } from "./Scope";
import { ParamType, AnyType } from "./Types";
import { Identifier } from "./Parser";
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
   BinaryOpType,
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

   translate(node: AstNode, scope: Scope): Type {
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
                  ? this.translate(node.type, scope)
                  : undefined;
               return new GenericNamedType(name, extendedType);
            }
            return new Type();
         case "UnaryOperator":
            if (!(node instanceof UnaryOperator)) {
               throw Error("Not right type");
            }
            if (node.operator === "...") {
               return new VarargsType(this.translate(node.expression, scope));
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
                  let translated = this.translateRoundTypeToTypeLambdaParameter(
                     p,
                     scope
                  );
                  return translated;
               }),
               this.translate(node.returnType, scope)
            );
         case "RoundValueToValueLambda":
            // return new RoundValueToValueLambdaType(node.params.map(p => this.translate(p, scope/)))
            if (!(node instanceof RoundValueToValueLambda)) {
               throw new Error("Weird type");
            }
            const innerScope = scope.innerScopeOf(node, true);
            innerScope.run = this.context.run;
            // innerScope.declareType("T", new NamedType("T"));
            const type = new RoundValueToValueLambdaType(
               node.params.map((p) =>
                  this.translateRoundTypeToTypeLambdaParameter(p, innerScope)
               ),
               this.translate(node.block.statements[0], innerScope),
               node.isTypeLambda
            );
            if (
               node.params.length > 0 &&
               node.params[0] instanceof Assignment &&
               node.params[0].lhs instanceof Identifier &&
               node.params[0].lhs.value === "this"
            ) {
               type.isFirstParamThis = true;
            }
            return type;
         case "SquareTypeToTypeLambda":
            // return new RoundValueToValueLambdaType(node.params.map(p => this.translate(p, scope/)))
            if (!(node instanceof SquareTypeToTypeLambda)) {
               throw new Error("Weird type");
            }
            const innerScope2 = scope.innerScopeOf(node, true);
            innerScope2.run = this.context.run;
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
         case "SquareApply":
            if (!(node instanceof SquareApply)) {
               return new Type();
            }
            return new AppliedGenericType(
               this.translate(node.callee, scope),
               node.typeArgs.map((arg) => this.translate(arg, scope))
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
               return new ParamType(fieldType, f.name, f.defaultValue);
            });
            return new StructType(node.name, fieldTypes);
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
               this.translate(node.left, scope),
               node.operator,
               this.translate(node.right, scope)
            );
         case "Optional":
            if (!(node instanceof Optional)) {
               return new Type();
            }
            return new OptionalType(this.translate(node.expression, scope));
         case "Group":
            if (node instanceof Group) {
               return this.translate(node.value, scope);
            }
         default:
            throw new Error("Could not translate " + node.tag);
      }
   }

   translateRoundTypeToTypeLambdaParameter(
      node: Term,
      scope: Scope
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
         if (!node.type && !node.value) {
            throw new Error(
               "Cannot deduce type from typeless, valueless parameter."
            );
         }
         let explicitType;
         if (node.type) {
            explicitType = this.translate(node.type, scope);
         }
         let inferredType;
         if (node.value) {
            inferredType = this.context.inferencer.infer(node.value, scope);
         }
         const name = node.lhs.value;
         const value = node.value;

         let type: Type = AnyType;
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
