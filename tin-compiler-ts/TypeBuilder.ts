import {
   AstNode,
   Assignment,
   Block,
   RoundApply,
   RoundValueToValueLambda,
   SquareTypeToValueLambda,
   WhileLoop,
   IfStatement,
   BinaryExpression,
   TypeCheck,
   RoundTypeToTypeLambda,
   Change,
   Literal,
} from "./Parser";
import { Scope, TypePhaseContext, RecursiveResolutionOptions } from "./Scope";
import {
   StructType,
   SquareTypeToTypeLambdaType,
   BinaryOpType,
   RoundValueToValueLambdaType,
} from "./Types";
import {
   Select,
   SquareTypeToTypeLambda,
   SquareApply,
   Import,
   Identifier,
} from "./Parser";
import { type } from "os";
import { TypeDef } from "./Parser";
import { Symbol } from "./Scope";
import { NamedType } from "./Types";
import { SquareTypeToValueLambdaType } from "./Types";
import {
   OptionalType,
   GenericNamedType,
   LiteralType,
   Type,
   AppliedGenericType,
} from "./Types";

export class TypeBuilder {
   context: TypePhaseContext;
   constructor(context: TypePhaseContext) {
      this.context = context;
   }

   // Walk through the AST and infer types for definitions
   build(
      node: AstNode,
      scope: Scope,
      options: RecursiveResolutionOptions = {}
   ) {
      if (node instanceof Assignment) {
         this.buildSymbolForAssignment(node, scope, options);
      } else if (node instanceof Block) {
         const innerBlockScope = scope.innerScopeOf(node, true);
         node.statements.forEach((statement) =>
            this.build(statement, innerBlockScope)
         );
      } else if (node instanceof RoundApply) {
         this.buildRoundApply(node, scope);
      } else if (node instanceof RoundValueToValueLambda) {
         this.buildRoundValueToValueLambda(node, scope, options);
      } else if (node instanceof SquareTypeToValueLambda) {
         this.buildSquareTypeToValueLambda(node, scope);
      } else if (node instanceof SquareTypeToTypeLambda) {
         this.build(node.returnType, scope);
      } else if (node instanceof WhileLoop) {
         this.buildWhileLoop(node, scope);
      } else if (node instanceof IfStatement) {
         const innerScope = scope.innerScopeOf(node, true);
         const trueScope = innerScope.innerScopeOf(node.trueBranch, true);
         if (
            node.condition instanceof BinaryExpression &&
            node.condition.operator === "!=" &&
            node.condition.left instanceof Identifier &&
            node.condition.right instanceof Identifier &&
            node.condition.right.value === "nothing"
         ) {
            const leftType = trueScope.resolveFully(
               this.context.inferencer.infer(node.condition.left, trueScope)
            );
            if (leftType instanceof OptionalType) {
               const symbol = new Symbol(
                  node.condition.left.value,
                  leftType.type
               );
               symbol.shadowing = innerScope.lookup(node.condition.left.value);
               trueScope.declare(node.condition.left.value, symbol);
            }
         }
         if (
            node.condition instanceof TypeCheck &&
            node.condition.term instanceof Identifier
         ) {
            const presumedType = scope.resolveNamedType(
               this.context.translator.translate(node.condition.type, trueScope)
            );
            trueScope.declare(
               node.condition.term.value,
               new Symbol(
                  node.condition.term.value,
                  presumedType,
                  node.condition.term
               )
            );
         }
         this.build(node.condition, innerScope);
         this.build(node.trueBranch, trueScope);
         if (node.falseBranch) {
            this.build(node.falseBranch, innerScope);
         }
      } else if (node instanceof Select) {
         this.buildSelect(node, scope);
      } else if (node instanceof TypeDef) {
         this.buildTypeDef(node, scope);
      } else if (node instanceof BinaryExpression) {
         this.build(node.left, scope);
         this.build(node.right, scope);
      } else if (node instanceof Change) {
         this.build(node.lhs, scope);
         this.build(node.value, scope);
      } else if (node instanceof SquareApply) {
         this.build(node.callee, scope);
         // this.build(node., scope);
      } else if (
         node instanceof Import ||
         node instanceof Literal ||
         node instanceof Identifier
      ) {
      } else {
         // console.error("Didn't build node of tag = " + node.tag);
      }
   }

   buildRoundApply(node: RoundApply, scope: Scope) {
      const calleeType = this.context.inferencer.infer(node.callee, scope);
      if (!(calleeType instanceof RoundValueToValueLambdaType)) {
         // will be hanlded in TypeChecker
         if (
            calleeType instanceof SquareTypeToValueLambdaType &&
            calleeType.returnType instanceof RoundValueToValueLambdaType
         ) {
            node.autoFilledSquareParams = [];
            const expectedTypeParams = calleeType.paramTypes;
            const expectedParams = calleeType.returnType.params;
            const appliedParams = node.args;
            // If Varargs
            if (
               expectedParams.length === 1 &&
               expectedParams[0].type instanceof AppliedGenericType &&
               expectedParams[0].type.callee instanceof NamedType &&
               expectedParams[0].type.callee.name === "Array"
            ) {
               let firstAppliedParamType = this.context.inferencer.infer(
                  appliedParams[0][1],
                  scope
               );
               if (firstAppliedParamType instanceof LiteralType) {
                  firstAppliedParamType = firstAppliedParamType.type;
               }
               // If array past raw, not as varargs 'func(Array@of(1, 2, 3))'
               if (
                  firstAppliedParamType instanceof AppliedGenericType &&
                  firstAppliedParamType.callee instanceof NamedType &&
                  firstAppliedParamType.callee.name === "Array"
               ) {
                  if (
                     expectedParams[0].type.parameterTypes[0] instanceof
                        GenericNamedType &&
                     firstAppliedParamType.parameterTypes[0] instanceof
                        NamedType
                  ) {
                     node.autoFilledSquareParams = [
                        firstAppliedParamType.parameterTypes[0],
                     ];
                  } else if (
                     expectedParams[0].type.parameterTypes[0] instanceof
                        NamedType &&
                     firstAppliedParamType.parameterTypes[0] instanceof
                        NamedType
                  ) {
                  }
                  // Varargs
               } else {
                  node.autoFilledSquareParams = [firstAppliedParamType];
                  node.takesVarargs = true;
               }
            } else {
               // Not Varargs
               let i = 0;
               for (let [appliedName, appliedTerm] of appliedParams) {
                  let appliedType = this.context.inferencer.infer(
                     appliedTerm,
                     scope
                  );
                  if (appliedType instanceof LiteralType) {
                     appliedType = appliedType.type;
                  }
                  const expectedType = appliedName
                     ? expectedParams.find((p) => p.name === appliedName)
                     : expectedParams[i];
                  if (expectedType && expectedType.type instanceof NamedType) {
                     let index = -1;
                     while (index < expectedTypeParams.length) {
                        if (
                           expectedTypeParams[index]?.name ===
                           expectedType.type.name
                        ) {
                           node.autoFilledSquareParams[index] = appliedType;
                           break;
                        }
                        index++;
                     }
                  }
                  i++;
               }
            }
         }
      } else {
         node.args.forEach((statement, i) =>
            this.build(statement[1], scope, {
               typeExpectedInPlace: calleeType?.params?.[i]?.type,
            })
         );
      }
      this.build(node.callee, scope);
   }

   buildTypeDef(node: TypeDef, scope: Scope) {
      const innerScope = scope.innerScopeOf(node, true);
      for (let param of node.fieldDefs) {
         if (param.defaultValue) this.build(param.defaultValue, innerScope);
         if (param.type) this.build(param.type, innerScope);
      }
   }

   buildSelect(node: Select, scope: Scope) {
      this.context.inferencer.infer(node, scope); // To assign ownerComponent
      let parentType = this.context.inferencer.infer(node.owner, scope);

      let ammortized = false;
      if (parentType instanceof OptionalType && node.ammortized) {
         parentType = parentType.type;
         ammortized = true;
      }
      // const fields = this.context.inferencer.getAllKnownFields()
   }

   buildRoundValueToValueLambda(
      node: RoundValueToValueLambda,
      scope: Scope,
      options: RecursiveResolutionOptions = {}
   ) {
      const innerScope = scope.innerScopeOf(node, true);
      node.params.forEach((p, i) => {
         if (p instanceof Assignment && p.lhs instanceof Identifier) {
            const hasSymbol = innerScope.hasSymbol(p.lhs.value);
            if (hasSymbol) {
               return;
            }
            if (
               options.typeExpectedInPlace instanceof
                  RoundValueToValueLambdaType &&
               options.typeExpectedInPlace.params[i]
            ) {
               this.build(p, innerScope, {
                  typeExpectedInPlace:
                     options.typeExpectedInPlace.params[i].type,
               });
            } else {
               this.build(p, innerScope);
            }
         }
      });
      this.build(node.block, innerScope);
      const inferredType = this.context.inferencer.inferRoundValueToValueLambda(
         node,
         scope,
         options
      );
      node.type = inferredType;
   }

   buildSquareTypeToValueLambda(node: SquareTypeToValueLambda, scope: Scope) {
      const innerScope = scope.innerScopeOf(node, true);
      node.parameterTypes.forEach((p) => {
         const type = this.context.translator.translate(p, innerScope);
         if (type instanceof GenericNamedType) {
            if (!innerScope.hasTypeSymbol(type.name)) {
               innerScope.declareType(type.name, type);
            }
         }
      });
      this.build(node.block, innerScope);
   }

   buildSymbolForAssignment(
      node: Assignment,
      scope: Scope,
      options: RecursiveResolutionOptions
   ) {
      // If it's not a declaration
      if (
         this.context.run == 0 &&
         node.lhs instanceof Identifier &&
         scope.hasSymbol(node.lhs.value)
      ) {
         node.isDeclaration = false;
         return;
      }

      const lhs = node.lhs;
      // When lambda like (i) -> i + 1 with i having an expected type
      if (
         lhs instanceof Identifier &&
         options.typeExpectedInPlace &&
         node.isParameter
      ) {
         scope.declare(
            lhs.value,
            new Symbol(lhs.value, options.typeExpectedInPlace)
         );
      }

      // Means it's a parameter
      if (!node.value) {
         if (node.type && node.lhs instanceof Identifier) {
            const symbol = new Symbol(
               node.lhs.value,
               this.context.translator.translate(node.type, scope),
               node
            );
            scope.declare(node.lhs.value, symbol);
         }
         return;
      }
      this.build(node.value, scope);
      let rhsType = this.context.inferencer.infer(node.value, scope);
      if (!node.type) {
         if (rhsType instanceof LiteralType) {
            rhsType = rhsType.type;
         }
         scope.mapAst(node, rhsType ? rhsType : new Type());
      } else {
         let nodeType = scope.resolveNamedType(
            this.context.translator.translate(node.type, scope)
         );
         if (nodeType instanceof AppliedGenericType) {
            scope.resolveAppliedGenericTypes(nodeType);
         }
         if (!rhsType.isAssignableTo(scope.resolveNamedType(nodeType), scope)) {
            this.context.errors.add(
               `Assignment of ${
                  node.lhs instanceof Identifier ? node.lhs.value : "term"
               }`,
               nodeType,
               rhsType,
               node.position,
               new Error()
            );
         } else {
            rhsType = scope.resolveNamedType(nodeType);
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
               this.context.translator.translate(node.value, scope)
            );
         } else {
            const symbolToDeclare = this.context.translator.translate(
               node.value,
               scope
            );
            if (symbolToDeclare instanceof StructType) {
               symbolToDeclare.name = node.lhs.value;
            }
            if (node.value instanceof TypeDef) {
               node.value.name = node.lhs.value;
            }
            if (
               node.value instanceof SquareTypeToTypeLambda &&
               node.value.returnType instanceof TypeDef
            ) {
               node.value.returnType.name = node.lhs.value;
            }
            // Possibly needs recursion
            if (
               symbolToDeclare instanceof SquareTypeToTypeLambdaType &&
               symbolToDeclare.returnType instanceof StructType
            ) {
               symbolToDeclare.name = node.lhs.value;
               symbolToDeclare.returnType.name = node.lhs.value;
            }
            if (!scope.hasTypeSymbol(node.lhs.value)) {
               scope.declareType(node.lhs.value, symbolToDeclare);
            }
         }
         return;
      }
      if (!(lhs instanceof Identifier)) {
         throw new Error(
            "Could not declare new variable, maybe you tried to set a field without 'set'"
         );
      }
      let symbol = new Symbol(lhs.value, rhsType, node);

      if (node.isDeclaration || node.isParameter) {
         symbol = symbol.located(node.position, node.position);
         if (!scope.hasSymbol(lhs.value)) {
            scope.declare(lhs.value, symbol);
            node.symbol = symbol;
         }
      }
   }

   buildWhileLoop(node: WhileLoop, scope: Scope) {
      const innerScope = scope.innerScopeOf(node, true);
      this.build(node.condition, innerScope);
      if (
         node.condition instanceof BinaryExpression &&
         node.condition.operator === "!=" &&
         node.condition.left instanceof Identifier &&
         node.condition.right instanceof Identifier &&
         node.condition.right.value === "nothing"
      ) {
         const leftType = scope.resolveFully(
            this.context.inferencer.infer(node.condition.left, scope)
         );
         if (leftType instanceof OptionalType) {
            const symbol = new Symbol(node.condition.left.value, leftType.type);
            symbol.shadowing = innerScope.lookup(node.condition.left.value);
            innerScope.declare(node.condition.left.value, symbol);
         }
      }
      if (node.start) {
         this.build(node.start, innerScope);
      }
      if (node.eachLoop) {
         this.build(node.eachLoop, innerScope);
      }
      this.build(node.action, innerScope);
   }
}
