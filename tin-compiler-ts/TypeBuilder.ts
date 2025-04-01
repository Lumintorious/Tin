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
   Change,
   Term,
   Cast,
} from "./Parser";
import { Scope, TypePhaseContext, RecursiveResolutionOptions } from "./Scope";
import {
   StructType,
   SquareTypeToTypeLambdaType,
   BinaryOpType,
   RoundValueToValueLambdaType,
   ParamType,
} from "./Types";
import {
   Select,
   SquareTypeToTypeLambda,
   SquareApply,
   Import,
   Identifier,
} from "./Parser";
import { type } from "os";
import { TypeDef, AppliedKeyword, Literal, Group, RefinedDef } from "./Parser";
import { Symbol } from "./Scope";
import { NamedType, TypeOfTypes, AnyTypeClass, UncheckedType } from "./Types";
import { SquareTypeToValueLambdaType, MutableType } from "./Types";
import {
   OptionalType,
   GenericNamedType,
   LiteralType,
   Type,
   AppliedGenericType,
} from "./Types";
import { brotliDecompress } from "zlib";
import { UnaryOperator } from "./Parser";

export class TypeBuilder {
   context: TypePhaseContext;
   constructor(context: TypePhaseContext) {
      this.context = context;
   }

   // Walk through the AST and infer types for definitions
   private buildCache = new Set<string>();
   build(
      node: AstNode,
      scope: Scope,
      options: RecursiveResolutionOptions = {}
   ) {
      const cachedString = `${node.id}.${scope.iteration}`;
      if (this.buildCache.has(cachedString)) {
         return;
      } else {
         this.buildCache.add(cachedString);
      }
      if (node instanceof Assignment) {
         this.buildSymbolForAssignment(node, scope, options);
      } else if (node instanceof Block) {
         const innerBlockScope = scope.innerScopeOf(node, true);
         node.statements.forEach((statement) =>
            this.build(statement, innerBlockScope)
         );
      } else if (node instanceof RoundApply) {
         this.buildRoundApply(node, scope, options);
      } else if (node instanceof AppliedKeyword) {
         this.build(node.param, scope);
      } else if (node instanceof TypeCheck) {
         this.build(node.term, scope);
         this.build(node.type, scope);
      } else if (node instanceof RoundValueToValueLambda) {
         this.buildRoundValueToValueLambda(node, scope, options);
      } else if (node instanceof SquareTypeToValueLambda) {
         this.buildSquareTypeToValueLambda(node, scope);
      } else if (node instanceof SquareTypeToTypeLambda) {
         const innerScope = scope.innerScopeOf(node, true);
         for (let param of node.parameterTypes) {
            if (
               param instanceof Assignment &&
               param.isParameter &&
               param.lhs instanceof Identifier
            ) {
               innerScope.declareType(
                  new Symbol(
                     param.lhs.value,
                     new GenericNamedType(
                        param.lhs.value,
                        param.type
                           ? this.context.translator.translate(
                                param.type,
                                innerScope
                             )
                           : undefined
                     )
                  )
               );
            }
         }
         this.build(node.returnType, innerScope, {
            assignedName: options.assignedName,
         });
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
               trueScope.declare(symbol);
            }
         }
         if (
            node.condition instanceof TypeCheck &&
            node.condition.term instanceof Identifier
         ) {
            const currentType = this.context.inferencer.infer(
               node.condition.term,
               innerScope
            );
            const presumedType = scope.resolveNamedType(
               this.context.translator.translate(node.condition.type, trueScope)
            );
            trueScope.declare(
               new Symbol(
                  node.condition.term.value,
                  new BinaryOpType(currentType, "&", presumedType, true),
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
         this.buildTypeDef(node, scope, options);
      } else if (node instanceof RefinedDef) {
         this.build(node.lambda, scope, options);
      } else if (node instanceof BinaryExpression) {
         this.buildBinaryExpression(node, scope, options);
      } else if (node instanceof Change) {
         this.build(node.lhs, scope);
         this.build(node.value, scope);
      } else if (node instanceof SquareApply) {
         this.build(node.callee, scope);
         let calleeType: Type;
         try {
            calleeType = this.context.inferencer.infer(node.callee, scope);
            if (
               node.callee instanceof Identifier &&
               node.callee.isTypeIdentifier()
            ) {
               node.callee.isInValueContext = false;
               calleeType = scope.lookupType(node.callee.value).typeSymbol;
            }
            let constructor = calleeType.buildConstructor();
            let isStructConstructor = false;
            if (constructor instanceof RoundValueToValueLambdaType) {
               calleeType = constructor;
               isStructConstructor = true;
               node.isCallingAConstructor = true;
            }
         } catch (e) {
            if (scope.iteration === "DECLARATION") {
               return;
            } else {
               throw e;
            }
         }
      } else if (node instanceof Import) {
      } else if (node instanceof Identifier) {
         this.context.inferencer.inferIdentifier(node, scope, options);
      } else if (node instanceof Literal) {
         if (options.isTypeLevel) {
            node.isTypeLiteral = true;
            node.isTypeLevel = true;
         }
      } else if (node instanceof Cast) {
         this.build(node.expression, scope);
         this.build(node.type, scope);
         const castType = this.context.translator.translate(node.type, scope);
         const termType = this.context.inferencer.infer(node.expression, scope);
         this.buildVarTransformations(node, castType, termType);
      } else if (node instanceof Group) {
         this.build(node.value, scope);
      } else if (node instanceof UnaryOperator) {
         if (
            node.operator === "var" &&
            node.expression instanceof UnaryOperator &&
            node.expression.operator === "var"
         ) {
            this.context.errors.add(
               "Chill with the var vars",
               undefined,
               undefined,
               node.position
            );
         }
         this.build(node.expression, scope);
      } else {
      }
   }

   buildBinaryExpression(
      node: BinaryExpression,
      scope: Scope,
      options: RecursiveResolutionOptions
   ) {
      if (options.isTypeLevel) {
         node.isTypeLevel = true;
      }

      const leftType = this.context.inferencer.infer(node.left, scope);
      const rightType = this.context.inferencer.infer(node.right, scope);
      this.build(node.left, scope, { isTypeLevel: options.isTypeLevel });
      this.build(node.right, scope, {
         isTypeLevel: options.isTypeLevel,
         firstPartOfIntersection: leftType,
      });
      if (options.isTypeLevel) {
         return;
      }
      if (leftType instanceof MutableType) {
         node.left.varTypeInInvarPlace = true;
      }

      if (rightType instanceof MutableType) {
         node.right.varTypeInInvarPlace = true;
      }
   }

   buildSquareArgsInRoundApply(node: RoundApply, scope: Scope) {
      const calleeType = this.context.inferencer.infer(node.callee, scope);
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
            if (appliedParams.length === 0) {
               node.takesVarargs = true;
               return;
            }
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
                  firstAppliedParamType.parameterTypes[0] instanceof NamedType
               ) {
                  node.autoFilledSquareParams = [
                     firstAppliedParamType.parameterTypes[0],
                  ];
               } else if (
                  expectedParams[0].type.parameterTypes[0] instanceof
                     NamedType &&
                  firstAppliedParamType.parameterTypes[0] instanceof NamedType
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
   }

   buildRoundApply(
      node: RoundApply,
      scope: Scope,
      options: RecursiveResolutionOptions
   ) {
      let calleeType;
      let isStructConstructor = false;
      try {
         calleeType = this.context.inferencer.infer(node.callee, scope, {
            typeExpectedAsOwner: node.args[0]?.[1]
               ? this.context.inferencer.infer(node.args[0][1], scope)
               : undefined,
         });
         if (
            node.callee instanceof Identifier &&
            node.callee.isTypeIdentifier()
         ) {
            calleeType = scope.lookupType(node.callee.value).typeSymbol;
         }
         let constructor = calleeType.buildConstructor();
         if (constructor instanceof RoundValueToValueLambdaType) {
            calleeType = constructor;
            isStructConstructor = true;
            node.isCallingAConstructor = true;
         }
      } catch (e) {
         if (scope.iteration === "DECLARATION") {
            return;
         } else {
            throw e;
         }
      }
      if (!(calleeType instanceof RoundValueToValueLambdaType)) {
         // will be hanlded in TypeChecker
         this.buildSquareArgsInRoundApply(node, scope);
      } else {
         const thisOffset = calleeType?.params?.[0]?.name === "this" ? 1 : 0;
         node.args.forEach((statement, i) => {
            const expectedType = calleeType?.params?.[i + thisOffset]?.type;
            const gottenType = this.context.inferencer.infer(
               statement[1],
               scope,
               {
                  typeExpectedInPlace: expectedType,
               }
            );
            let captureName = undefined;
            if (isStructConstructor && !(expectedType instanceof MutableType)) {
               captureName =
                  statement[1] instanceof Identifier ? statement[1].value : "";
            }
            if (scope.iteration === "RESOLUTION") {
               this.buildVarTransformations(
                  statement[1],
                  expectedType,
                  gottenType,
                  captureName
               );
            }
            this.build(statement[1], scope, {
               typeExpectedInPlace: expectedType,
            });
         });
      }
      this.build(node.callee, scope);
   }

   buildTypeDef(
      node: TypeDef,
      scope: Scope,
      options: RecursiveResolutionOptions
   ) {
      const innerScope = scope.innerScopeOf(node, true);
      node.name = options.assignedName;
      for (let param of node.fieldDefs) {
         if (param.defaultValue && scope.iteration == "RESOLUTION") {
            this.build(param.defaultValue, innerScope);
         }
         if (param.type)
            this.build(param.type, innerScope, { assignedName: "ISTYPE" });
      }
   }

   buildSelect(node: Select, scope: Scope) {
      // if (scope.iteration === "DECLARATION") return;
      this.context.inferencer.infer(node, scope); // To assign ownerComponent
      this.build(node.owner, scope);
      let parentType = this.context.inferencer.infer(node.owner, scope);
      if (parentType instanceof MutableType) {
         node.owner.varTypeInInvarPlace = true;
      }

      let ammortized = false;
      if (parentType instanceof OptionalType && node.ammortized) {
         parentType = parentType.type;
         ammortized = true;
      }
      // const fields = this.context.inferencer.getAllKnownFields()
   }

   convertToTailrec(
      node: Term,
      scope: Scope,
      lambdaName: String,
      lambdaParamsInOrder: ParamType[],
      options: RecursiveResolutionOptions
   ): Term {
      if (node instanceof AppliedKeyword && node.keyword === "return") {
         return this.convertToTailrec(
            node.param,
            scope,
            lambdaName,
            lambdaParamsInOrder,
            options
         );
      } else if (node instanceof Block) {
         const innerScope = scope.innerScopeOf(node);
         const statements = node.statements.map((s) =>
            this.convertToTailrec(
               s,
               innerScope,
               lambdaName,
               lambdaParamsInOrder,
               options
            )
         );
         return new Block(statements);
      } else if (node instanceof IfStatement) {
         const innerScope = scope.innerScopeOf(node);
         const trueScope = innerScope.innerScopeOf(node.trueBranch);
         const falseScope =
            node.falseBranch instanceof Block
               ? innerScope.innerScopeOf(node.falseBranch)
               : innerScope;
         const ifStatement = new IfStatement(
            node.condition,
            this.convertToTailrec(
               node.trueBranch,
               trueScope,
               lambdaName,
               lambdaParamsInOrder,
               options
            ),
            node.falseBranch
               ? this.convertToTailrec(
                    node.falseBranch,
                    falseScope,
                    lambdaName,
                    lambdaParamsInOrder,
                    options
                 )
               : undefined
         );
         if (!(ifStatement.trueBranch instanceof Block)) {
            ifStatement.trueBranch = new Block([ifStatement.trueBranch]);
         }
         if (
            ifStatement.falseBranch &&
            !(ifStatement.falseBranch instanceof Block)
         ) {
            ifStatement.falseBranch = new Block([ifStatement.falseBranch]);
         }
         return ifStatement;
      } else if (node instanceof WhileLoop && node.eachLoop) {
      } else if (node instanceof BinaryExpression) {
      } else if (node instanceof UnaryOperator) {
      } else if (
         node instanceof RoundApply &&
         node.callee instanceof Identifier &&
         node.callee.value === lambdaName
      ) {
         const statements: Term[] = [];
         for (let i = 0; i < lambdaParamsInOrder.length; i++) {
            const paramType = lambdaParamsInOrder[i];
            if (paramType.name !== undefined) {
               statements.push(
                  new Assignment(
                     new Identifier(paramType.name + "_"),
                     node.args[i][1]
                  )
               );
            }
         }
         for (let i = 0; i < lambdaParamsInOrder.length; i++) {
            const paramType = lambdaParamsInOrder[i];
            if (paramType.name !== undefined) {
               statements.push(
                  new Change(
                     new Identifier(paramType.name),
                     new Identifier(paramType.name + "_")
                  )
               );
            }
         }
         return new AppliedKeyword("unchecked", new Block(statements, true));
      }
      return node;
   }

   convertLambdaToTailrecIfPossible(
      node: RoundValueToValueLambda,
      scope: Scope,
      options: RecursiveResolutionOptions
   ): RoundValueToValueLambda {
      const innerScope = scope.innerScopeOf(node);
      const returns: [Term, Type][] = [];
      this.context.inferencer.findReturns(node.block, innerScope, returns);
      let shouldConvert = false;
      if (node.isTypeLambda || node.isTypeLevel) {
         return node;
      }
      for (const [term, type] of returns) {
         if (
            !(term instanceof RoundApply) ||
            !(term.callee instanceof Identifier) ||
            term.callee.value != options.assignedName
         ) {
            continue;
         }
         shouldConvert = true;
         break;
      }

      if (!shouldConvert || !options.assignedName) {
         return node;
      }

      const block = this.convertToTailrec(
         node.block,
         innerScope,
         options.assignedName,
         node.params.map((s) =>
            this.context.translator.translateRoundTypeToTypeLambdaParameter(
               s,
               innerScope,
               {}
            )
         ),
         {}
      );
      const newInnerBlock = new Block([
         new WhileLoop(
            undefined,
            new Literal("true", "Boolean"),
            undefined,
            block
         ),
      ]);
      this.build(newInnerBlock, innerScope);
      node.block = newInnerBlock;

      return node;
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
      if (options.assignedName) {
         node.name = options.assignedName;
      }
      this.build(node.block, innerScope);
      const inferredType = this.context.inferencer.inferRoundValueToValueLambda(
         node,
         scope,
         options
      );
      if (scope.iteration === "RESOLUTION") {
         if (inferredType instanceof RoundValueToValueLambdaType) {
            node.type = inferredType;
            this.convertLambdaToTailrecIfPossible(node, scope, options);

            if (scope.iteration === "RESOLUTION") {
               const dependencies: Symbol[] = [];
               for (const statement of node.block.statements) {
                  dependencies.push(
                     ...this.termDependencies(statement, scope, innerScope)
                  );
                  if (dependencies.length === 0) continue;
               }
               if (dependencies.length > 0) {
                  node.clojure = dependencies;
               }
            }
         }
      }
   }

   buildSquareTypeToValueLambda(node: SquareTypeToValueLambda, scope: Scope) {
      const innerScope = scope.innerScopeOf(node, true);
      node.parameterTypes.forEach((p) => {
         const type = this.context.translator.translate(p, innerScope);
         if (type instanceof GenericNamedType) {
            if (!innerScope.hasTypeSymbol(type.name)) {
               innerScope.declareType(new Symbol(type.name, type));
            }
         }
      });
      this.build(node.block, innerScope);
   }

   buildVarTransformations(
      term: Term,
      expectedType?: Type,
      termType?: Type,
      capturedName?: string
   ) {
      const expectedMutable = expectedType instanceof MutableType;
      if (capturedName !== undefined) {
         term.capturedName = capturedName;
      } else if (expectedMutable && !(termType instanceof MutableType)) {
         term.invarTypeInVarPlace = true;
      } else if (!expectedMutable && termType instanceof MutableType) {
         term.varTypeInInvarPlace = true;
      }
   }

   termDependencies(term: Term, boundaryScope: Scope, scope: Scope): Symbol[] {
      if (term instanceof Identifier) {
         if (
            !term.isTypeIdentifier() &&
            boundaryScope.hasSymbol(term.value) &&
            !scope.hasSymbol(term.value, boundaryScope)
         ) {
            const symbol = scope.lookup(term.value);
            if (symbol.isLink) {
               term.isFromSelfClojure = true;
               return [symbol];
            } else {
               return [];
            }
         }
      } else if (term instanceof BinaryExpression) {
         return [
            ...this.termDependencies(term.left, boundaryScope, scope),
            ...this.termDependencies(term.right, boundaryScope, scope),
         ];
      } else if (term instanceof RoundApply) {
         return [
            ...this.termDependencies(term.callee, boundaryScope, scope),
            ...term.args.flatMap((arg) =>
               this.termDependencies(arg[1], boundaryScope, scope)
            ),
         ];
      } else if (term instanceof UnaryOperator && term.operator === "var") {
         return [
            ...this.termDependencies(term.expression, boundaryScope, scope),
         ];
      } else if (term instanceof RoundValueToValueLambda) {
         return this.termDependencies(
            term.block,
            boundaryScope,
            scope.innerScopeOf(term, true)
         );
      } else if (term instanceof Block) {
         return term.statements.flatMap((statement) =>
            this.termDependencies(
               statement,
               boundaryScope,
               scope.innerScopeOf(term, true)
            )
         );
      } else if (term instanceof Select) {
         return this.termDependencies(term.owner, boundaryScope, scope);
      } else if (term instanceof Group) {
         return this.termDependencies(term.value, boundaryScope, scope);
      }
      return [];
   }

   assignClojure(
      clojure: Symbol[],
      term: Term,
      hitLambda: boolean,
      scope: Scope
   ) {
      function getSymbol(name: string) {
         return clojure.find((t) => t.name === name);
      }
      if (term instanceof Identifier) {
         const symbol = getSymbol(term.value);
         if (symbol && hitLambda) {
            term.isFromSelfClojure = true;
         }
      } else if (term instanceof BinaryExpression) {
         this.assignClojure(clojure, term.left, hitLambda, scope);
         this.assignClojure(clojure, term.right, hitLambda, scope);
      } else if (term instanceof RoundApply) {
         this.assignClojure(clojure, term.callee, hitLambda, scope);
         term.args.forEach((arg) =>
            this.assignClojure(clojure, arg[1], hitLambda, scope)
         );
      } else if (term instanceof UnaryOperator && term.operator === "var") {
         this.assignClojure(clojure, term.expression, hitLambda, scope);
      } else if (term instanceof RoundValueToValueLambda) {
         this.assignClojure(clojure, term.block, true, scope);
      } else if (term instanceof Block) {
         term.statements.forEach((statement) =>
            this.assignClojure(clojure, statement, hitLambda, scope)
         );
      } else if (term instanceof Select) {
         this.assignClojure(clojure, term.owner, hitLambda, scope);
      } else if (term instanceof Group) {
         this.assignClojure(clojure, term.value, hitLambda, scope);
      }
      return [];
   }

   buildSymbolForAssignment(
      node: Assignment,
      scope: Scope,
      options: RecursiveResolutionOptions
   ) {
      const lhs = node.lhs;

      if (lhs instanceof Identifier) {
         if (
            scope.symbols.has(lhs.value) &&
            !(scope.lookup(lhs.value).typeSymbol instanceof UncheckedType) &&
            scope.iteration === "DECLARATION"
         ) {
            throw new Error("Redeclaration of assignment " + lhs.value);
         }

         if (lhs.isTypeIdentifier()) {
            scope.declareType(new Symbol(lhs.value, new UncheckedType()));
         } else {
            // scope.declare(new Symbol(lhs.value, new UncheckedType()));
         }
      }

      // When lambda like (i) -> i + 1 with i having an expected type
      if (
         lhs instanceof Identifier &&
         options.typeExpectedInPlace &&
         node.isParameter
      ) {
         scope.declare(
            new Symbol(lhs.value, options.typeExpectedInPlace).mutable(
               node.isMutable
            )
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
            scope.declare(
               symbol.mutable(
                  node.isMutable || symbol.typeSymbol instanceof MutableType
               ),
               true
            );
         }
         return;
      }

      this.build(node.value, scope, {
         assignedName:
            node.lhs instanceof Identifier ? node.lhs.value : undefined,
         isTypeLevel:
            node.lhs instanceof Identifier && node.lhs.isTypeIdentifier(),
      });
      let rhsType = this.context.inferencer.infer(node.value, scope, {
         assignedName:
            node.lhs instanceof Identifier ? node.lhs.value : undefined,
         isTypeLevel:
            node.lhs instanceof Identifier && node.lhs.isTypeIdentifier(),
         expectsBroadenedType: true,
      });
      let isMutable = rhsType instanceof MutableType;
      if (!node.type) {
         if (rhsType instanceof LiteralType) {
            rhsType = rhsType.type;
         }
         scope.mapAst(
            node,
            "TYPE",
            new Symbol(undefined as any, rhsType ? rhsType : new Type())
         );
      } else {
         let nodeType = scope.resolveNamedType(
            this.context.translator.translate(node.type, scope)
         );
         if (nodeType instanceof MutableType) {
            isMutable = true;
         }
         if (rhsType instanceof MutableType) {
            node.value.varTypeInInvarPlace = true;
         }
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
               undefined,
               new Error()
            );
         } else {
            rhsType = scope.resolveNamedType(nodeType);
         }
      }
      if (
         node.lhs instanceof Identifier &&
         node.lhs.value &&
         (node.isTypeLevel ||
            node.lhs.isTypeLevel ||
            this.context.inferencer.isCapitalized(
               options.assignedName || "lowercase"
            ) ||
            rhsType instanceof TypeOfTypes)
      ) {
         if (node.value instanceof RoundValueToValueLambda) {
            node.value.isTypeLambda = true;
            scope.declareType(
               new Symbol(
                  node.lhs.value,
                  this.context.translator.translate(node.value, scope)
               )
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
            // if (!scope.hasTypeSymbol(node.lhs.value)) {
            scope.declareType(new Symbol(node.lhs.value, symbolToDeclare));
            // }
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
         symbol.isPrivate = node.private === true;
         symbol.isLink = node.isLink === true;
         scope.declare(symbol.mutable(isMutable), true);
         node.symbol = symbol;
         // }
      }
   }

   buildWhileLoop(node: WhileLoop, scope: Scope) {
      const innerScope = scope.innerScopeOf(node, true);
      this.build(node.condition, innerScope);
      // if (
      //    node.condition instanceof BinaryExpression &&
      //    node.condition.operator === "!=" &&
      //    node.condition.left instanceof Identifier &&
      //    node.condition.right instanceof Identifier &&
      //    node.condition.right.value === "nothing"
      // ) {
      //    const leftType = innerScope.resolveNamedType(
      //       this.context.inferencer.infer(node.condition.left, innerScope)
      //    );
      //    if (leftType instanceof OptionalType) {
      //       const symbol = new Symbol(node.condition.left.value, leftType.type);
      //       symbol.shadowing = innerScope.lookup(node.condition.left.value);
      //       innerScope.declare(symbol);
      //    }
      // }
      if (node.start) {
         this.build(node.start, innerScope);
      }
      if (node.eachLoop) {
         this.build(node.eachLoop, innerScope);
      }
      this.build(node.action, innerScope);
   }
}
