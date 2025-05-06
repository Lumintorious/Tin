import {
   AstNode,
   Assignment,
   Block,
   Call,
   RoundValueToValueLambda,
   SquareTypeToValueLambda,
   WhileLoop,
   IfStatement,
   BinaryExpression,
   TypeCheck,
   Change,
   Term,
   Cast,
   ARTIFICIAL,
   IN_RETURN_BRANCH,
   BAKED_TYPE,
} from "./Parser";
import {
   Scope,
   TypePhaseContext,
   RecursiveResolutionOptions,
   walkTerms,
} from "./Scope";
import {
   StructType,
   SquareTypeToTypeLambdaType,
   RoundValueToValueLambdaType,
   ParamType,
} from "./Types";
import {
   SquareTypeToTypeLambda,
   Import,
   INVAR_RETURNING_FUNC_IN_VAR_PLACE,
} from "./Parser";
import { type } from "os";
import {
   TypeDef,
   AppliedKeyword,
   Literal,
   Group,
   RefinedDef,
   Make,
} from "./Parser";
import { Symbol, GenericTypeMap } from "./Scope";
import { Select, Tuple, Identifier } from "./Parser";
import {
   TypeOfTypes,
   AnyType,
   UncheckedType,
   IntersectionType,
   UnionType,
} from "./Types";
import {
   SquareTypeToValueLambdaType,
   MutableType,
   NamedType,
   NothingType,
} from "./Types";
import {
   OptionalType,
   GenericNamedType,
   LiteralType,
   Type,
   AppliedGenericType,
} from "./Types";
import { UnaryOperator, VAR_RETURNING_FUNC_IN_INVAR_PLACE } from "./Parser";

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
      } else if (node instanceof Call && node.kind !== "SQUARE") {
         this.buildRoundApply(node, scope, options);
      } else if (node instanceof AppliedKeyword) {
         this.build(node.param, scope);
      } else if (node instanceof TypeCheck) {
         this.build(node.term, scope);
         this.build(node.type, scope, { isTypeLevel: true });
         const leftType = this.context.inferencer.infer(node.term, scope);
         if (leftType instanceof MutableType) {
            node.term.varTypeInInvarPlace = true;
         }
      } else if (node instanceof RoundValueToValueLambda) {
         this.buildRoundValueToValueLambda(node, scope, options);
      } else if (node instanceof SquareTypeToValueLambda) {
         this.buildSquareTypeToValueLambda(node, scope);
      } else if (node instanceof SquareTypeToTypeLambda) {
         if (options.assignedName) {
            node.name = options.assignedName;
         }
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
         const trueScope = innerScope
            .innerScopeOf(node.trueBranch, true)
            .named("true");
         const falseScope = node.falseBranch
            ? innerScope.innerScopeOf(node.falseBranch, true).named("false")
            : new Scope("Throwaway");
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
         const trueSymbols: Symbol[] = [];
         const falseSymbols: Symbol[] = [];

         this.deduceCheckedTypes(
            node.condition,
            trueSymbols,
            falseSymbols,
            innerScope
         );

         for (const symbol of trueSymbols) {
            trueScope.declare(symbol, true);
         }
         for (const symbol of falseSymbols) {
            falseScope.declare(symbol, true);
         }

         const hasNoFalseBranch =
            !node.falseBranch ||
            (node.falseBranch instanceof Block &&
               node.falseBranch.statements?.[0] instanceof Literal &&
               node.falseBranch.statements[0].value === "null");
         if (
            hasNoFalseBranch &&
            ((node.trueBranch instanceof AppliedKeyword &&
               node.trueBranch.keyword === "return") ||
               (node.trueBranch instanceof Block &&
                  node.trueBranch.statements.length > 0 &&
                  node.trueBranch.statements[0] instanceof AppliedKeyword &&
                  node.trueBranch.statements[0].keyword === "return"))
         ) {
            for (const symbol of falseSymbols) {
               scope.declare(symbol, true);
            }
         }

         this.build(node.condition, innerScope);
         this.build(node.trueBranch, trueScope);
         if (node.falseBranch) {
            this.build(node.falseBranch, falseScope);
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
      } else if (node instanceof Call && node.kind === "SQUARE") {
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
            node.args.forEach(([n, t]) =>
               this.build(t, scope, { isTypeLevel: options.isTypeLevel })
            );
         } catch (e) {
            if (scope.iteration === "DECLARATION") {
               return;
            } else {
               throw e;
            }
         }
      } else if (node instanceof Import) {
      } else if (node instanceof Identifier) {
         if (scope.iteration === "RESOLUTION") {
            this.context.inferencer.inferIdentifier(node, scope, options);
         }
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
         const deps: Identifier[] = [];
         walkTerms(node.expression, scope, (node, scope) => {
            if (node instanceof Identifier && !node.isTypeIdentifier()) {
               const symbol = scope.lookup(node.value);
               if (symbol.typeSymbol instanceof MutableType) {
                  deps.push(node);
               }
            }
         });
         node.varDependencies = deps;
         this.build(node.expression, scope);
      } else if (node instanceof Tuple) {
         node.expressions.forEach((e) => this.build(e, scope));
      } else {
      }
   }

   deduceCheckedTypes(
      condition: Term,
      trueSymbols: Symbol[],
      falseSymbols: Symbol[],
      scope: Scope
   ) {
      if (
         condition instanceof TypeCheck &&
         condition.term instanceof Identifier
      ) {
         const shadowSymbol = condition.term.isTypeIdentifier()
            ? scope.lookupType(condition.term.value)
            : scope.lookup(condition.term.value);
         let type = this.context.translator.translate(condition.type, scope);
         let checkedType = shadowSymbol.typeSymbol;
         let wasMutable = false;
         if (checkedType instanceof MutableType) {
            checkedType = checkedType.type;
            wasMutable = true;
         }
         if (checkedType instanceof UnionType) {
            let allUnionTypes = checkedType.getAllSeparateUnionedTypes();
            allUnionTypes = allUnionTypes.filter((t) => t.name !== type.name);
            let negativeType = UnionType.ofAll(allUnionTypes);
            if (wasMutable) {
               negativeType = new MutableType(negativeType);
            }
            const newSymbol = new Symbol(
               shadowSymbol.name,
               new UncheckedType()
            );
            newSymbol.rewriteFrom(shadowSymbol);
            newSymbol.shadowing = shadowSymbol;
            newSymbol.typeSymbol = negativeType;
            (condition.negative ? trueSymbols : falseSymbols).push(newSymbol);
            scope.declare(newSymbol, true);
         }
         if (checkedType instanceof OptionalType) {
            let negativeType = checkedType.type;
            if (wasMutable) {
               negativeType = new MutableType(negativeType);
            }
            const newSymbol = new Symbol(
               shadowSymbol.name,
               new UncheckedType()
            );
            newSymbol.rewriteFrom(shadowSymbol);
            newSymbol.shadowing = shadowSymbol;
            newSymbol.typeSymbol = negativeType;
            (condition.negative ? trueSymbols : falseSymbols).push(newSymbol);
            scope.declare(newSymbol, true);
         }
         const newType = new IntersectionType(
            shadowSymbol.typeSymbol,
            type
         ).simplified();
         if (
            shadowSymbol.typeSymbol instanceof MutableType &&
            !(type instanceof MutableType)
         ) {
            type = new MutableType(type);
         }
         const newSymbol = new Symbol(shadowSymbol.name, new UncheckedType());
         newSymbol.rewriteFrom(shadowSymbol);
         newSymbol.shadowing = shadowSymbol;
         newSymbol.typeSymbol = newType;
         (condition.negative ? falseSymbols : trueSymbols).push(newSymbol);
         scope.declare(newSymbol, true);
      } else if (
         condition instanceof BinaryExpression &&
         condition.operator === "&&"
      ) {
         const innerScope = scope.innerScopeOf(condition, true);
         this.deduceCheckedTypes(
            condition.left,
            trueSymbols,
            falseSymbols,
            innerScope
         );
         this.deduceCheckedTypes(
            condition.right,
            trueSymbols,
            falseSymbols,
            innerScope
         );
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
      if (scope.childrenByAst.has(node.id)) {
         scope = scope.innerScopeOf(node);
      }
      const leftType = this.context.inferencer.infer(node.left, scope);
      this.build(node.left, scope, { isTypeLevel: options.isTypeLevel });
      if (node.operator === "where") {
         scope = scope.innerScopeOf(node, true);
         scope.declare(
            new Symbol(
               "self",
               this.context.translator.translate(node.left, scope)
            )
         );
         this.build(node.right, scope);
      } else {
         this.build(node.right, scope, {
            isTypeLevel: options.isTypeLevel,
            firstPartOfIntersection:
               node.operator === "&" ? leftType : undefined,
         });
      }
      if (options.isTypeLevel) {
         return;
      }
      const rightType = this.context.inferencer.infer(node.right, scope, {
         isTypeLevel: options.isTypeLevel,
      });
      if (leftType instanceof MutableType) {
         node.left.varTypeInInvarPlace = true;
      }

      if (rightType instanceof MutableType) {
         node.right.varTypeInInvarPlace = true;
      }
   }

   matchParamToGenericParam(
      expectedTypeParams: Type[],
      gottenType: Type,
      expectedType: Type
   ): GenericTypeMap {
      // f = [A, B] -> (a: A, b: B) -> a
      // f(1, "Str")
      const matchedGenericParam = expectedTypeParams.find(
         (tp) => tp.name === expectedType.name
      );

      if (
         expectedType instanceof NamedType &&
         matchedGenericParam !== undefined
      ) {
         if (!(matchedGenericParam instanceof GenericNamedType)) {
            return GenericTypeMap.empty();
         }
         if (gottenType instanceof LiteralType) {
            gottenType = gottenType.type;
         }
         return GenericTypeMap.with(matchedGenericParam.name, gottenType);
      } else if (
         expectedType instanceof AppliedGenericType &&
         gottenType instanceof AppliedGenericType
      ) {
         const map = new GenericTypeMap();
         map.absorb(
            this.matchParamToGenericParam(
               expectedTypeParams,
               gottenType.callee,
               expectedType.callee
            )
         );
         for (let i = 0; i < expectedType.parameterTypes.length; i++) {
            map.absorb(
               this.matchParamToGenericParam(
                  expectedTypeParams,
                  gottenType.parameterTypes[i],
                  expectedType.parameterTypes[i]
               )
            );
         }
         return map;
      } else if (
         expectedType instanceof RoundValueToValueLambdaType &&
         gottenType instanceof RoundValueToValueLambdaType
      ) {
         const map = new GenericTypeMap();
         for (let i = 0; i < expectedType.params.length; i++) {
            map.absorb(
               this.matchParamToGenericParam(
                  expectedTypeParams,
                  gottenType.params[i].type,
                  expectedType.params[i].type
               )
            );
         }
         map.absorb(
            this.matchParamToGenericParam(
               expectedTypeParams,
               gottenType.returnType,
               expectedType.returnType
            )
         );
         return map;
      } else if (
         expectedType instanceof SquareTypeToValueLambdaType &&
         gottenType instanceof SquareTypeToValueLambdaType
      ) {
         const map = new GenericTypeMap();
         map.absorb(
            this.matchParamToGenericParam(
               expectedTypeParams,
               gottenType.returnType,
               expectedType.returnType
            )
         );
         return map;
      } else if (
         expectedType instanceof MutableType &&
         gottenType instanceof MutableType
      ) {
         return this.matchParamToGenericParam(
            expectedTypeParams,
            gottenType.type,
            expectedType.type
         );
      }
      return GenericTypeMap.empty();
   }

   expectsVarargs(expectedParams: ParamType[]) {
      return (
         expectedParams.length === 1 &&
         expectedParams[0].type instanceof AppliedGenericType &&
         expectedParams[0].type.callee instanceof NamedType &&
         expectedParams[0].type.callee.name === "Array"
      );
   }

   isFirstParamArray(calledParams: [string, Term][], scope: Scope) {
      const firstParamType =
         calledParams.length === 0
            ? undefined
            : this.context.inferencer.infer(calledParams[0][1], scope);
      return (
         firstParamType instanceof AppliedGenericType &&
         firstParamType.callee.name === "Array"
      );
   }

   buildSquareArgsInRoundApply(node: Call, calleeType: Type, scope: Scope) {
      if (
         calleeType instanceof SquareTypeToValueLambdaType &&
         calleeType.returnType instanceof RoundValueToValueLambdaType
      ) {
         let selfType: Type | undefined = undefined;
         if (node.bakedInThis) {
            selfType = this.context.inferencer.infer(node.bakedInThis, scope);
         }
         const genericTypeArgs = new GenericTypeMap();
         node.initTypeArgs(genericTypeArgs);
         const expectedTypeParams = calleeType.paramTypes;
         const expectedParams = calleeType.returnType.params;
         const appliedParams = node.args;
         const firstParamType =
            node.args.length === 0
               ? undefined
               : this.context.inferencer.infer(node.args[0][1], scope);
         // If Varargs
         if (
            expectedParams.length === 1 &&
            expectedParams[0].type instanceof AppliedGenericType &&
            expectedParams[0].type.callee instanceof NamedType &&
            expectedParams[0].type.callee.name === "Array" &&
            !(
               firstParamType instanceof AppliedGenericType &&
               firstParamType.callee.name === "Array"
            )
         ) {
            node.takesVarargs = true;
            if (node.bakedInThis) {
               const selfType = this.context.inferencer.infer(
                  node.bakedInThis,
                  scope
               );
               if (selfType instanceof AppliedGenericType) {
                  for (let i = 0; i < selfType.parameterTypes.length; i++) {
                     genericTypeArgs.absorb(
                        this.matchParamToGenericParam(
                           calleeType.paramTypes,
                           selfType.parameterTypes[i],
                           (
                              calleeType.returnType.params[0]
                                 .type as AppliedGenericType
                           ).parameterTypes[0]
                        )
                     );
                  }
               }
               node.takesVarargs = false;
            }

            if (appliedParams.length === 0) {
               return;
            }
            let firstAppliedParamType = this.context.inferencer.infer(
               appliedParams[0][1],
               scope
            );
            if (firstAppliedParamType instanceof LiteralType) {
               firstAppliedParamType = firstAppliedParamType.type;
            }
            // If array passed raw, not as varargs 'func(Array@of(1, 2, 3))'
            if (
               firstAppliedParamType instanceof AppliedGenericType &&
               firstAppliedParamType.callee instanceof NamedType &&
               firstAppliedParamType.callee.name === "Array"
            ) {
               node.takesVarargs = false;
               if (
                  expectedParams[0].type.parameterTypes[0] instanceof
                     GenericNamedType &&
                  firstAppliedParamType.parameterTypes[0] instanceof NamedType
               ) {
                  genericTypeArgs.set(
                     expectedParams[0].type.parameterTypes[0].name,
                     firstAppliedParamType.parameterTypes[0]
                  );
               }
               // Varargs
            } else {
               genericTypeArgs.absorb(
                  this.matchParamToGenericParam(
                     calleeType.paramTypes,
                     firstAppliedParamType,
                     (
                        calleeType.returnType.params[0]
                           .type as AppliedGenericType
                     ).parameterTypes[0]
                  )
               );
               node.takesVarargs = true;
            }
         } else {
            // Not Varargs
            let i = 0;
            let hasThisIncrement = node.bakedInThis ? 1 : 0;
            const mappings = new GenericTypeMap();
            if (
               node.bakedInThis &&
               expectedParams.filter((p) => p.name === "self").length > 0
            ) {
               let appliedType = this.context.inferencer.infer(
                  node.bakedInThis,
                  scope
               );
               if (appliedType instanceof LiteralType) {
                  appliedType = appliedType.type;
               }
               const expectedType = expectedParams[0];
               if (expectedType) {
                  mappings.absorb(
                     this.matchParamToGenericParam(
                        expectedTypeParams,
                        appliedType,
                        expectedType.type
                     )
                  );
               }
            }

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
                  : expectedParams[i + hasThisIncrement];

               if (expectedType) {
                  mappings.absorb(
                     this.matchParamToGenericParam(
                        expectedTypeParams,
                        appliedType,
                        expectedType.type
                     )
                  );
               }

               i++;
            }
            node.initTypeArgs(mappings);
         }
      }
   }

   buildRoundApply(
      node: Call,
      scope: Scope,
      options: RecursiveResolutionOptions
   ) {
      let calleeType;
      let isStructConstructor = false;
      try {
         this.context.inferencer.handleExtensionSearch(node, scope);

         calleeType = this.context.inferencer.infer(node.callee, scope, {
            typeExpectedAsOwner:
               node.args[0]?.[0] === "self"
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
         if (constructor) {
            node.isCallingAConstructor = true;
         }
         if (
            calleeType instanceof RoundValueToValueLambdaType &&
            calleeType.isConstructor
         ) {
            node.isCallingAConstructor = true;
            isStructConstructor = true;
         }
         if (constructor instanceof RoundValueToValueLambdaType) {
            calleeType = constructor;
            isStructConstructor = true;
            node.isCallingAConstructor = true;
         }
         if (constructor instanceof SquareTypeToValueLambdaType) {
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
      let paramTypes: ParamType[] = [];
      if (!(calleeType as any).pure) {
         node.callsPure = false;
      }
      if (!(calleeType instanceof RoundValueToValueLambdaType)) {
         // will be hanlded in TypeChecker
         this.buildSquareArgsInRoundApply(node, calleeType, scope);
         if (
            calleeType instanceof SquareTypeToValueLambdaType &&
            calleeType.returnType instanceof RoundValueToValueLambdaType &&
            node.getTypeArgs()
         ) {
            const mappedParams = node.getTypeArgs();
            paramTypes = calleeType.returnType.params.map(
               (p) =>
                  new ParamType(
                     scope.resolveGenericTypes(p.type, mappedParams as any),
                     p.name,
                     p.defaultValue
                  )
            );
         }
      } else {
         paramTypes = calleeType?.params;
      }
      const thisOffset = paramTypes[0]?.name === "self" ? 1 : 0;
      node.args.forEach((statement, i) => {
         const expectedType = paramTypes[i + thisOffset]?.type;
         this.build(statement[1], scope, {
            typeExpectedInPlace: expectedType,
         });
         const gottenType = this.context.inferencer.infer(statement[1], scope, {
            typeExpectedInPlace: expectedType,
         });
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
      });
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
      const asName = node.nameAsSelectOfIdentifiers();
      try {
         if (asName !== undefined) {
            const symbol = scope.lookup(asName);
            if (symbol) {
               node.isBeingTreatedAsIdentifier = true;
               return;
            }
         }
      } catch (e) {}
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
         const prevType = this.context.inferencer.infer(node, scope);
         const statements = node.statements.map((s) =>
            this.convertToTailrec(
               s,
               innerScope,
               lambdaName,
               lambdaParamsInOrder,
               options
            )
         );
         return new Block(statements)
            .modify(IN_RETURN_BRANCH)
            .modify(BAKED_TYPE.as(prevType));
      } else if (node instanceof IfStatement) {
         const innerScope = scope.innerScopeOf(node);
         const trueScope = innerScope.innerScopeOf(node.trueBranch);
         const falseScope =
            node.falseBranch instanceof Block
               ? innerScope.innerScopeOf(node.falseBranch)
               : innerScope;
         const ifStatement = node;
         const result = new IfStatement(
            node.condition,
            this.convertToTailrec(
               node.trueBranch,
               trueScope,
               lambdaName,
               lambdaParamsInOrder,
               options
            ).modify(IN_RETURN_BRANCH),
            node.falseBranch
               ? this.convertToTailrec(
                    node.falseBranch,
                    falseScope,
                    lambdaName,
                    lambdaParamsInOrder,
                    options
                 ).modify(IN_RETURN_BRANCH)
               : undefined
         );
         if (!(result.trueBranch instanceof Block)) {
            result.trueBranch = new Block([result.trueBranch]).modify(
               IN_RETURN_BRANCH
            );
         }
         if (result.falseBranch && !(result.falseBranch instanceof Block)) {
            result.falseBranch = new Block([result.falseBranch]).modify(
               IN_RETURN_BRANCH
            );
         }
         this.build(ifStatement, innerScope);
         return result;
      } else if (node instanceof WhileLoop && node.eachLoop) {
      } else if (node instanceof BinaryExpression) {
      } else if (node instanceof UnaryOperator) {
      } else if (
         node instanceof Call &&
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
                  ).modify(ARTIFICIAL)
               );
            }
         }
         return new AppliedKeyword("unchecked", new Block(statements, true));
      }
      console.log(node);
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
            !(term instanceof Call) ||
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
      //   const prevId = node.block.id;
      const prevType = this.context.inferencer.infer(node.block, innerScope);
      //   newInnerBlock.id = prevId;
      newInnerBlock.modify(BAKED_TYPE.as(prevType));
      node.block = newInnerBlock;

      return node;
   }

   buildRoundValueToValueLambda(
      node: RoundValueToValueLambda,
      scope: Scope,
      options: RecursiveResolutionOptions = {}
   ) {
      if (options.assignedName) {
         node.name = options.assignedName;
      }
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
      if (node.specifiedType && scope.iteration === "DECLARATION") {
         return;
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
      if (
         expectedType instanceof RoundValueToValueLambdaType &&
         termType instanceof RoundValueToValueLambdaType
      ) {
         const expectedReturn = expectedType.returnType;
         const gottenReturn = termType.returnType;
         const expectedMutable = expectedReturn instanceof MutableType;
         const gotMutable = gottenReturn instanceof MutableType;
         if (expectedMutable && !gotMutable) {
            term.modify(INVAR_RETURNING_FUNC_IN_VAR_PLACE);
         } else if (!expectedType && gotMutable) {
            term.modify(VAR_RETURNING_FUNC_IN_INVAR_PLACE);
         }
      }

      const expectedMutable = expectedType instanceof MutableType;
      if (
         capturedName !== undefined &&
         !(termType instanceof MutableType) &&
         !expectedMutable
      ) {
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
      } else if (term instanceof Call) {
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
      } else if (term instanceof Call) {
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
         assignedName: node.lhs.show(),
         isTypeLevel:
            node.lhs instanceof Identifier && node.lhs.isTypeIdentifier(),
      });
      let rhsType = this.context.inferencer.infer(node.value, scope, {
         assignedName:
            node.lhs instanceof Identifier ? node.lhs.value : undefined,
         isTypeLevel:
            node.lhs instanceof Identifier && node.lhs.isTypeIdentifier(),
         expectsBroadenedType: !node.type,
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
         let nodeTypeRaw = this.context.translator.translate(node.type, scope);
         let nodeType = scope.resolveNamedType(nodeTypeRaw);
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
               `Declaration of ${
                  node.lhs instanceof Identifier ? node.lhs.value : "term"
               }`,
               nodeType,
               rhsType,
               node.position,
               undefined,
               new Error()
            );
         } else {
            rhsType = nodeTypeRaw;
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
      if (!(lhs instanceof Identifier || lhs instanceof Select)) {
         throw new Error(
            "Could not declare new variable, maybe you tried to set a field without 'set'"
         );
      }
      let symbolName: string | undefined;
      if (lhs instanceof Identifier) {
         symbolName = lhs.value;
      } else if (lhs instanceof Select) {
         symbolName = lhs.nameAsSelectOfIdentifiers();
         lhs.isDeclaration = true;
         node.isDeclaration = true;
         if (symbolName !== undefined) {
         } else {
            try {
               const inferredOwnerType = this.context.inferencer.infer(
                  lhs.owner,
                  scope
               );
               const field = this.context.inferencer.findField(
                  inferredOwnerType,
                  lhs.field,
                  scope
               );
               if (field) {
                  throw new Error(
                     `Could not declare ${symbolName}. It would shadow the name of a field on ${inferredOwnerType}`
                  );
               }
            } finally {
            }
         }
      }

      if (!symbolName) {
         throw new Error(
            "Could not declare new variable, maybe you tried to set a field without 'set'"
         );
      }
      let symbol = new Symbol(symbolName, rhsType, node);

      if (node.isDeclaration || node.isParameter) {
         symbol = symbol.located(node.position, node.position);
         symbol.isPrivate = node.private === true;
         symbol.isLink = node.isLink === true;
         if (scope.iteration === "DECLARATION" && scope.hasSymbol(symbolName)) {
            throw new Error(`Value ${symbolName} already exists`);
         }
         scope.declare(symbol.mutable(isMutable), false);
         node.symbol = symbol;
         // }
      }
   }

   buildWhileLoop(node: WhileLoop, scope: Scope) {
      const innerScope = scope.innerScopeOf(node, true);
      this.build(node.condition, innerScope);
      const conditionScope = innerScope.innerScopeOf(node.condition, true);

      const trueSymbols: Symbol[] = [];
      const falseSymbols: Symbol[] = [];

      this.deduceCheckedTypes(
         node.condition,
         trueSymbols,
         falseSymbols,
         conditionScope
      );

      for (const symbol of trueSymbols) {
         innerScope.declare(symbol);
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
