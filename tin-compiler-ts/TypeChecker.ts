import { TokenPos } from "./Lexer";
import { SquareTypeToValueLambda, SquareApply, WhileLoop } from "./Parser";
import {
   SquareTypeToTypeLambda,
   Change,
   Block,
   Assignment,
   IfStatement,
   RoundApply,
   Select,
   Identifier,
   AstNode,
   Term,
   BinaryExpression,
} from "./Parser";
import { Scope, TypePhaseContext } from "./Scope";
import { RoundValueToValueLambda, TypeDef } from "./Parser";
import { RecursiveResolutionOptions } from "./Scope";
import { UncheckedType } from "./Types";
import {
   AppliedGenericType,
   BinaryOpType,
   GenericNamedType,
   LiteralType,
   MarkerType,
   NamedType,
   OptionalType,
   ParamType,
   RoundValueToValueLambdaType,
   SquareTypeToTypeLambdaType,
   SquareTypeToValueLambdaType,
   StructType,
   Type,
   TypeOfTypes,
   TypeRoundValueToValueLambda,
   VarargsType,
} from "./Types";

export function getConstructorName(typeName: string) {
   return typeName;
}
// TYPE INFERENCER
export class TypeChecker {
   // errors: TypeErrorList;
   // outerScope: Scope;
   // fileScope: Scope;
   // run: number = 0;
   // constructor() {
   //    this.errors = new TypeErrorList();
   //    this.outerScope = new Scope("Language");
   //    this.fileScope = new Scope("File", this.outerScope);
   // }
   context: TypePhaseContext;
   constructor(context: TypePhaseContext) {
      this.context = context;
   }

   resolvedGeneric(type: AppliedGenericType, scope: Scope): Type {
      let callee = type.callee;
      if (callee instanceof Identifier) {
         callee = scope.lookupType(callee.value).typeSymbol;
      }
      if (callee instanceof NamedType) {
         callee = scope.lookupType(callee.name).typeSymbol;
      }
      if (callee && callee instanceof RoundValueToValueLambdaType) {
         const actualParams = type.parameterTypes;
         const expectedParams = callee.params;
         let params: { [_: string]: Type } = {};
         expectedParams.forEach((p, i) => {
            if (p.type.name) {
               params[p.type.name] = actualParams[i];
            }
         });
         const resolved = scope.resolveGenericTypes(callee.returnType, params);
         type.resolved = resolved;
         return type.resolved;
      }
      if (callee && callee instanceof SquareTypeToTypeLambdaType) {
         const actualParams = type.parameterTypes;
         const expectedParams = callee.paramTypes;
         let params: { [_: string]: Type } = {};
         expectedParams.forEach((p, i) => {
            if (p.name) {
               params[p.name] = actualParams[i];
            }
         });
         const resolved = scope.resolveGenericTypes(callee.returnType, params);
         type.resolved = resolved;
         return type.resolved;
      }
      throw new Error("Could not resolve generic type " + type.toString());
   }

   typeCheckChange(node: Change, scope: Scope) {
      this.typeCheck(node.lhs, scope);
      this.typeCheck(node.value, scope);
      const leftType = this.context.inferencer.infer(node.lhs, scope);
      const rightType = this.context.inferencer.infer(node.value, scope);
      // if (node.lhs instanceof Identifier) {
      //    let symbol = scope.lookup(node.lhs.value);
      //    if (symbol.shadowing) {
      //       symbol = symbol.shadowing;
      //       scope.remove(symbol.name);
      //    }
      //    if (!symbol.isMutable) {
      //       this.context.errors.add(
      //          `Setting of mutable ${node.lhs.value}`,
      //          rightType,
      //          rightType,
      //          node.position
      //       );
      //    }
      // }
      if (!rightType.isAssignableTo(leftType, scope)) {
         if (node.lhs instanceof Identifier) {
            const symbol = scope.lookup(node.lhs.value);
            if (
               symbol.shadowing &&
               rightType.isAssignableTo(symbol.shadowing?.typeSymbol, scope)
            ) {
               scope.remove(node.lhs.value);
               return;
            }
         }

         let name = "";
         if (node.lhs instanceof Identifier) {
            name = node.lhs.value;
         }
         if (node.lhs instanceof Select) {
            name = node.lhs.field;
         }
         this.context.errors.add(
            `Setting of variable ${name}`,
            leftType,
            rightType,
            node.position
         );
      }
   }

   typeCheck(
      node: AstNode,
      scope: Scope,
      options: RecursiveResolutionOptions = {}
   ) {
      if (node instanceof Block) {
         const innerScope = scope.innerScopeOf(node);
         node.statements.forEach((c) =>
            this.typeCheck.bind(this)(c, innerScope)
         );
      } else if (node instanceof Assignment && node.value) {
         const options: RecursiveResolutionOptions = {};
         if (node.lhs instanceof Identifier) {
            options.assignedName = node.lhs.value;
         }
         this.typeCheck(node.value, scope, options);
      } else if (node instanceof Change) {
         this.typeCheckChange(node as Change, scope);
      } else if (node instanceof RoundApply) {
         this.typeCheckApply(node, scope, options);
      } else if (node instanceof SquareApply) {
         this.typeCheckSquareApply(node, scope);
      } else if (node instanceof RoundValueToValueLambda) {
         this.typeCheckRoundValueToValueLambda(node, scope, options);
      } else if (node instanceof SquareTypeToValueLambda) {
         this.typeCheckSquareTypeToValueLambda(node, scope);
      } else if (node instanceof SquareTypeToTypeLambda) {
         this.typeCheck(node.returnType, scope.innerScopeOf(node));
      } else if (node instanceof IfStatement) {
         const innerScope = scope.innerScopeOf(node);
         const trueScope = innerScope.innerScopeOf(node.trueBranch);
         this.typeCheck(node.condition, innerScope);
         this.typeCheck(node.trueBranch, trueScope);
         if (node.falseBranch) {
            this.typeCheck(node.falseBranch, innerScope);
         }
      } else if (node instanceof WhileLoop) {
         const innerScope = scope.innerScopeOf(node);
         this.typeCheck(node.condition, innerScope);
         if (node.eachLoop) {
            this.typeCheck(node.eachLoop, innerScope);
         }
      } else if (node instanceof TypeDef) {
         const innerScope = scope.innerScopeOf(node);
         node.fieldDefs.forEach((fd) => {
            if (fd.defaultValue) {
               this.typeCheck(fd.defaultValue, innerScope);
               if (fd.type) {
                  const inferredType = this.context.inferencer.infer(
                     fd.defaultValue,
                     innerScope
                  );
                  const expectedType = this.context.translator.translate(
                     fd.type,
                     innerScope
                  );
                  if (!inferredType.isAssignableTo(expectedType, innerScope)) {
                     this.context.errors.add(
                        "Default value of field " + fd.name,
                        expectedType,
                        inferredType,
                        fd.position
                     );
                  }
               }
            }
         });
      } else if (node instanceof BinaryExpression) {
         this.typeCheck(node.left, scope);
         const leftType = this.context.inferencer.infer(node.left, scope);
         this.typeCheck(node.right, scope, {
            firstPartOfIntersection: leftType,
         });
      } else if (node instanceof Select) {
         this.typeCheck(node.owner, scope);
      }
   }

   typeCheckRoundValueToValueLambda(
      node: RoundValueToValueLambda,
      scope: Scope,
      options: RecursiveResolutionOptions
   ) {
      const innerScope = scope.innerScopeOf(node);
      const returnType = this.context.inferencer.infer(node.block, innerScope);

      if (node.specifiedType) {
         const explicitType = this.context.translator.translate(
            node.specifiedType,
            innerScope
         );
         if (!returnType.isAssignableTo(explicitType, scope)) {
            this.context.errors.add(
               `Return type of lambda`,
               explicitType,
               returnType,
               node.position,
               new Error()
            );
         }
      }
      if (returnType instanceof UncheckedType) {
         this.context.errors.add(
            `Return type of recursive lambda was not explicitly specified`,
            undefined,
            returnType,
            node.position,
            new Error()
         );
      }

      node.params.forEach((p) => this.typeCheck(p, innerScope));
      const lambdaType = this.context.inferencer.infer(node, scope, options);
      if (
         options.assignedName &&
         this.context.inferencer.isCapitalized(options.assignedName)
      ) {
         return;
      }
      if (!(lambdaType instanceof RoundValueToValueLambdaType)) {
         throw new Error(
            "Calling non-lambda, was " +
               lambdaType.toString() +
               " - " +
               node.position?.start.line
         );
      }
      let type = this.context.inferencer.inferRoundValueToValueLambda(
         node,
         scope,
         { typeExpectedInPlace: lambdaType }
      );
      if (type instanceof RoundValueToValueLambdaType) {
         this.checkLambdaParamsValidity(type.params, scope);
      }
      this.typeCheck(node.block, innerScope);
   }

   checkLambdaParamsValidity(params: ParamType[], scope: Scope) {
      let hitNamed = false;
      let hitDefault = false;
      for (const param of params) {
         if (param.name) {
            hitNamed = true;
         }
         if (param.defaultValue) {
            hitDefault = true;
         }
         if (hitNamed && !param.name) {
            this.context.errors.add(
               "Cannot define nameless parameters after named ones "
            );
         }
         if (hitDefault && !param.defaultValue) {
            this.context.errors.add(
               "Cannot define parameter without default value, after ones with default values"
            );
         }
      }
   }

   typeCheckSquareTypeToValueLambda(
      node: SquareTypeToValueLambda,
      scope: Scope
   ) {
      const innerScope = scope.innerScopeOf(node);
      // node.pforEach((p) => this.typeCheck(p, innerScope));
      this.typeCheck(node.block, innerScope);
   }

   typeCheckSquareApply(apply: SquareApply, scope: Scope) {
      try {
         const testCalleeIsType = scope.resolveFully(
            this.context.translator.translate(apply.callee, scope)
         );
         if (testCalleeIsType instanceof SquareTypeToTypeLambdaType) {
            return;
         }
      } catch (e) {
         // It's ok, it wasn't a type lambda
      }
      const calleeType = scope.resolveNamedType(
         this.context.inferencer.infer(apply.callee, scope)
      );
      if (!(calleeType instanceof SquareTypeToValueLambdaType)) {
         throw new Error(
            "Cannot call non-square lambda with square parameters, was " +
               apply.callee.tag
         );
      }
      let i = 0;
      for (let paramType of calleeType.paramTypes) {
         if (!paramType.extendedType) {
            continue;
         }
         const gottenParamType = this.context.translator.translate(
            apply.typeArgs[i],
            scope
         );
         if (!gottenParamType.isAssignableTo(paramType.extendedType, scope)) {
            this.context.errors.add(
               `Parameter ${paramType.name} of Square Apply`,
               paramType.extendedType,
               gottenParamType,
               apply.position
            );
         }
         i++;
      }
   }

   typeCheckApply(
      apply: RoundApply,
      scope: Scope,
      options: RecursiveResolutionOptions
   ) {
      this.typeCheck(apply.callee, scope);
      let typeSymbol = this.context.inferencer.infer(apply.callee, scope);
      let mappings: { [_: string]: Type } = {};
      // if (
      //    typeSymbol instanceof SquareTypeToValueLambdaType &&
      //    typeSymbol.returnType instanceof RoundValueToValueLambdaType
      // ) {
      //    for (let i = 0; i < typeSymbol.paramTypes.length; i++) {
      //       if (apply.autoFilledSquareParams) {
      //          mappings[typeSymbol.paramTypes[i].name] =
      //             apply.autoFilledSquareParams[i];
      //       }
      //    }
      //    typeSymbol = scope.resolveGenericTypes(
      //       typeSymbol.returnType,
      //       mappings
      //    );
      // }

      if (typeSymbol instanceof RoundValueToValueLambdaType) {
         const params = typeSymbol.params;
         const hasThis = params.length > 0 && params[0].name === "this";
         apply.args.forEach((p, i) => {
            this.typeCheck(p[1], scope, {
               typeExpectedInPlace: params[i + (hasThis ? 1 : 0)]?.type,
            });
         });

         if (
            params[0] &&
            params[0].type instanceof AppliedGenericType &&
            params[0].type.callee.name === "Array"
         ) {
            const expectedType = scope.resolveNamedType(
               params[0].type.parameterTypes[0]
            );
            if (apply.args.length === 0) {
               apply.takesVarargs = true;
               return;
            }
            const firstArgType = () =>
               scope.resolveAppliedGenericTypes(
                  this.context.inferencer.infer(apply.args[0][1], scope)
               );

            if (
               apply.args.length > 0 &&
               firstArgType().isAssignableTo(
                  scope.resolveAppliedGenericTypes(params[0].type),
                  scope
               )
            ) {
               // It's ok, array expected, array gotten
            } else {
               apply.args.forEach((p, i) => {
                  const gottenType = this.context.inferencer.infer(p[1], scope);
                  if (!gottenType.isAssignableTo(expectedType, scope)) {
                     this.context.errors.add(
                        `Parameter ${i} of varargs ${
                           apply.callee instanceof Identifier
                              ? apply.callee.value
                              : "Anonymous function"
                        }`,
                        expectedType,
                        gottenType,
                        apply.position,
                        new Error()
                     );
                  }
               });
               apply.takesVarargs = true;
            }
            return;
         }
      }

      if (typeSymbol instanceof RoundValueToValueLambdaType) {
         let params = typeSymbol.params;
         const calleeType = this.context.inferencer.infer(apply.callee, scope);
         const paramOrder = this.typeCheckLambdaCall(
            apply,
            typeSymbol,
            apply.args,
            params,
            scope,
            {
               typeExpectedInPlace: calleeType,
               firstPartOfIntersection: options.firstPartOfIntersection,
            },
            options?.firstPartOfIntersection !== undefined &&
               apply.callee instanceof Identifier
         );
         apply.paramOrder = paramOrder;
      }
   }

   typeCheckLambdaCall(
      term: RoundApply,
      typeSymbol: Type,
      applyArgs: [string, Term][], // Positional arguments, with possible names
      expectedParams: ParamType[], // Expected parameter definitions
      scope: Scope,
      options: RecursiveResolutionOptions,
      areAllOptional: boolean
   ): [number, number][] /* How to shuffle parameters when translating */ {
      if (!(typeSymbol instanceof RoundValueToValueLambdaType)) {
         throw new Error("Was not Lambda");
      }
      let thisParam: ParamType | undefined = typeSymbol.params[0];
      if (thisParam?.name !== "this") {
         thisParam = undefined;
      }
      let checkedThis = false;
      if (thisParam && !(term.callee instanceof Select)) {
         checkedThis = true;
         if (!options.firstPartOfIntersection) {
            this.context.errors.add(
               "Previous part of intersection (&), parameter 'this' of '" +
                  (term.callee instanceof Identifier
                     ? term.callee.value
                     : "Anonymous function") +
                  "'",
               thisParam.type,
               undefined,
               term.position
            );
         } else {
            if (
               !options.firstPartOfIntersection.isAssignableTo(
                  thisParam.type,
                  scope
               )
            ) {
               this.context.errors.add(
                  "Previous part of intersection (&), parameter 'this' of '" +
                     (term.callee instanceof Identifier
                        ? term.callee.value
                        : "Anonymous function") +
                     "'",
                  thisParam.type,
                  options.firstPartOfIntersection,
                  term.position
               );
            } else {
            }
         }
      }
      const termName =
         term.callee instanceof Identifier
            ? term.callee.value
            : term.callee instanceof Select
            ? term.callee.field
            : "Anonymous lambda";
      let fulfilledNamedParams = new Set<String>();
      let fulfilledNumericParams = new Set<Number>();
      let unfulfilledExpectedParams = [
         ...expectedParams.filter((f) => f.name !== "this"),
      ];
      let paramOrder: [number, number][] = [];
      let hasThisParamIncrement =
         expectedParams[0] && expectedParams[0].name === "this" ? 1 : 0;

      if (hasThisParamIncrement === 1 && !checkedThis) {
         const expectedThisType = expectedParams[0].type;
         if (!(term.callee instanceof Select)) {
            this.context.errors.add(
               "Method with 'this' as a parameter must be called on the field of a struct",
               expectedThisType
            );
         } else {
            const calleeType = this.context.inferencer.infer(
               term.callee.owner,
               scope
            );
            if (!calleeType.isAssignableTo(expectedThisType, scope)) {
               this.context.errors.add(
                  `Call target ('this') of lambda ${term.callee.field}`,
                  expectedThisType,
                  calleeType
               );
            }
         }
         term.isFirstParamThis = true;
      }

      let namedPhase = false;
      for (let i = 0; i < applyArgs.length; i++) {
         const applyArg = applyArgs[i];
         const applyArgName = applyArg[0];
         if (applyArgName) {
            namedPhase = true; // Streak of unnamed parameter ended
         }
         if (namedPhase && !applyArgName) {
            this.context.errors.add(
               "Cannot use unnamed parameters after named ones at " + termName,
               undefined,
               undefined,
               applyArg[1].position
            );
         }
         if (applyArgName && fulfilledNamedParams.has(applyArgName)) {
            this.context.errors.add(
               `Parameter ${applyArgName} of ${termName} was already fulfilled perviously, without an explicit name`,
               undefined,
               undefined,
               applyArg[1].position
            );
            continue;
         }

         const expectedParam = applyArgName
            ? expectedParams.find((p) => p.name === applyArgName)
            : expectedParams[i + hasThisParamIncrement];
         if (!expectedParam) {
            this.context.errors.add(
               "Applying too many parameters to lambda " + termName
            );
            return [];
         }
         let appliedType;
         if (
            options.typeExpectedInPlace instanceof RoundValueToValueLambdaType
         ) {
            appliedType = this.context.inferencer.infer(applyArg[1], scope, {
               typeExpectedInPlace:
                  options.typeExpectedInPlace.params[i + hasThisParamIncrement]
                     .type,
            });
         } else {
            appliedType = this.context.inferencer.infer(applyArg[1], scope);
         }
         const expectedType = expectedParam.type;
         if (!appliedType.isAssignableTo(expectedType, scope)) {
            this.context.errors.add(
               `Parameter '${expectedParam.name || `[${i}]`}' of '${termName}'`,
               expectedType,
               appliedType,
               applyArg[1].position
            );
            continue;
         }
         // Else it's ok
         if (expectedParam.name) {
            fulfilledNamedParams.add(expectedParam.name);
         } else {
            fulfilledNumericParams.add(i);
         }
         unfulfilledExpectedParams = unfulfilledExpectedParams.filter(
            (p) => p !== expectedParam
         );

         if (!namedPhase) {
            paramOrder.push([i, i]);
         } else {
            paramOrder.push([i, expectedParams.indexOf(expectedParam)]);
         }
      }

      for (let param of unfulfilledExpectedParams) {
         if (param.defaultValue) {
            unfulfilledExpectedParams = unfulfilledExpectedParams.filter(
               (p) => p !== param
            );
         }
         if (param.type instanceof OptionalType) {
            unfulfilledExpectedParams = unfulfilledExpectedParams.filter(
               (p) => p !== param
            );
         }
      }

      if (unfulfilledExpectedParams.length > 0 && !areAllOptional) {
         this.context.errors.add(
            `Lambda ${termName} didn't have all of its non-optional parameters fulfilled, ${
               unfulfilledExpectedParams.length
            } params unfulfilled ${unfulfilledExpectedParams[0].type} ${
               "" + applyArgs.length + expectedParams.length
            }`,
            undefined,
            undefined,
            term.position
         );
      }

      return paramOrder;
   }
}

export class TypeErrorList {
   errors: {
      hint: string;
      expectedType?: Type;
      insertedType?: Type;
      position?: TokenPos;
      errorForStack?: Error;
   }[];
   context: TypePhaseContext;
   constructor(context: TypePhaseContext) {
      this.context = context;
      this.errors = [];
   }

   add(
      hint: string,
      expectedType?: Type,
      insertedType?: Type,
      position?: TokenPos,
      errorForStack?: Error
   ) {
      for (let error of this.errors) {
         if (
            error.hint === hint &&
            (expectedType === undefined ||
               expectedType.toString() === error.expectedType?.toString()) &&
            (insertedType === undefined ||
               insertedType.toString() === error.insertedType?.toString())
         ) {
            return;
         }
      }
      this.errors.push({
         hint,
         expectedType,
         insertedType,
         position,
         errorForStack,
      });
   }

   getErrors(showStack = true) {
      if (this.errors.length > 0) {
         const message =
            "There are type errors:\n" +
            this.errors
               .map(
                  (e) =>
                     `- ${e.hint} @ ${this.context.fileName}:${
                        e.position?.start.line
                     }:${e.position?.start.column}${
                        e.expectedType
                           ? `\n  > Expected '${e.expectedType?.toString()}'`
                           : ""
                     }${e.insertedType ? `\n  > Got '${e.insertedType}'` : ""}`
               )
               .join("\n");
         return message;
      }
   }
}
