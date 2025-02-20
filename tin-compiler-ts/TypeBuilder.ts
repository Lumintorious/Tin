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
   Identifier,
   TypeCheck,
   RoundTypeToTypeLambda,
} from "./Parser";
import { Symbol, Scope, TypePhaseContext } from "./Scope";
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
   build(node: AstNode, scope: Scope) {
      if (node instanceof Assignment) {
         this.buildSymbolForAssignment(node, scope);
      } else if (node instanceof Block) {
         const innerBlockScope = scope.innerScopeOf(node, true);
         node.statements.forEach((statement) =>
            this.build(statement, innerBlockScope)
         );
      } else if (node instanceof RoundApply) {
         const innerBlockScope = scope.innerScopeOf(node, true);
         node.args.forEach((statement) =>
            this.build(statement, innerBlockScope)
         );
         this.build(node.callee, scope);
      } else if (node instanceof RoundValueToValueLambda) {
         this.buildRoundValueToValueLambda(node, scope);
      } else if (node instanceof SquareTypeToValueLambda) {
         this.buildSquareTypeToValueLambda(node, scope);
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
            const presumedType = this.context.translator.translate(
               node.condition.type,
               trueScope
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
      }
   }

   buildRoundValueToValueLambda(node: RoundValueToValueLambda, scope: Scope) {
      const innerScope = scope.innerScopeOf(node, true);
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

   buildSymbolForAssignment(node: Assignment, scope: Scope) {
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
