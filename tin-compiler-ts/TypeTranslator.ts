import {
   AstNode,
   Identifier,
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
} from "./Parser";
import { TypePhaseContext, Scope, Symbol } from "./Scope";
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
                  let translated = this.translate(p, scope);
                  if (translated instanceof GenericNamedType) {
                     return new NamedType(translated.name);
                  }
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
               node.params.map((p) => this.translate(p, innerScope)),
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
            innerScope2.declareType("T", new NamedType("T"));
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
            const fieldTypes = node.fieldDefs.map((f) => {
               let fieldType: Type;
               if (f.type) {
                  fieldType = this.translate(f.type, scope);
               } else if (f.defaultValue) {
                  fieldType = this.context.inferencer.infer(
                     f.defaultValue,
                     scope
                  );
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
}
