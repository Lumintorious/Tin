import { TokenPos } from "./Lexer";
import {
   SquareTypeToValueLambda,
   WhileLoop,
   Statement,
   AppliedKeyword,
   UnaryOperator,
   Cast,
   Group,
   ARTIFICIAL,
   BAKED_TYPE,
} from "./Parser";
import {
   SquareTypeToTypeLambda,
   Change,
   Block,
   Assignment,
   IfStatement,
   Call,
   Select,
   AstNode,
   Term,
   BinaryExpression,
} from "./Parser";
import { Scope, TypePhaseContext, GenericTypeMap } from "./Scope";
import { RoundValueToValueLambda, TypeDef, RefinedDef, Tuple } from "./Parser";
import { RecursiveResolutionOptions } from "./Scope";
import { UncheckedType, MutableType } from "./Types";
import { Identifier, TypeCheck } from "./Parser";
import {
   AppliedGenericType,
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
         const expectedParams = callee.params.map((p) => p.type);
         const mappedParams = GenericTypeMap.fromPairs(
            expectedParams,
            actualParams
         );
         const resolved = scope.resolveGenericTypes(
            callee.returnType,
            mappedParams
         );
         type.resolved = resolved;
         return type.resolved;
      }
      if (callee && callee instanceof SquareTypeToTypeLambdaType) {
         const actualParams = type.parameterTypes;
         const expectedParams = callee.paramTypes;
         const mappedParams = GenericTypeMap.fromPairs(
            expectedParams,
            actualParams
         );
         const resolved = scope.resolveGenericTypes(
            callee.returnType,
            mappedParams
         );
         type.resolved = resolved;
         return type.resolved;
      }
      throw new Error("Could not resolve generic type " + type.toString());
   }

   typeCheckChange(node: Change, scope: Scope) {
      this.typeCheck(node.lhs, scope);
      this.typeCheck(node.value, scope);
      if (node.is(ARTIFICIAL)) {
         return;
      }
      const leftType = this.context.inferencer.infer(node.lhs, scope);
      const rightType = this.context.inferencer.infer(node.value, scope);
      let shadowedType = leftType;
      if (node.lhs instanceof Identifier) {
         let symbol = scope.lookup(node.lhs.value);
         if (symbol.shadowing) {
            symbol = symbol.shadowing;
            shadowedType = symbol.typeSymbol;
            scope.remove(symbol.name);
         }
         if (!symbol.isMutable && !(symbol.typeSymbol instanceof MutableType)) {
            this.context.errors.add(
               `Setting an immutable value '${node.lhs.value}'`,
               undefined,
               undefined,
               node.position,
               `Either declare '${
                  node.lhs.value
               }' as a variable type '~${symbol.typeSymbol.toString()}', or don't mutate it here.`
            );
         }
      } else if (node.lhs instanceof Select) {
         let ownerType = scope.resolveNamedType(
            this.context.inferencer.infer(node.lhs.owner, scope)
         ) as StructType;
         let fieldType = this.context.inferencer.findField(
            ownerType,
            node.lhs.field,
            scope
         );
         if (!fieldType?.mutable && !(fieldType?.type instanceof MutableType)) {
            this.context.errors.add(
               `Setting an immutable field '${node.lhs.show()}'`,
               undefined,
               undefined,
               node.position,
               `Either declare '${
                  fieldType?.name
               }' as a variable type '~${fieldType?.toString()}', or don't mutate it here.`
            );
         }
      }
      if (!rightType.isAssignableTo(leftType, scope)) {
         if (node.lhs instanceof Identifier) {
            if (
               shadowedType !== leftType &&
               rightType.isAssignableTo(shadowedType, scope)
            ) {
               return;
            }
         }

         this.context.errors.add(
            `Setting of variable ${node.lhs.show()}`,
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
         node.statements.forEach((c) => this.typeCheck(c, innerScope));
      } else if (node instanceof Assignment) {
         const options: RecursiveResolutionOptions = {};
         if (node.lhs instanceof Identifier) {
            options.assignedName = node.lhs.value;
         }
         this.typeCheck(node.lhs, scope);
         //  if (node.type) {
         //     this.typeCheck(node.type, scope, { isTypeLevel: true });
         //  }
         if (node.value) {
            this.typeCheck(node.value, scope, options);
         }
      } else if (node instanceof Change) {
         this.typeCheckChange(node as Change, scope);
      } else if (node instanceof Call && node.kind !== "SQUARE") {
         this.typeCheckApply(node, scope, options);
      } else if (node instanceof Call) {
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
         const falseScope = node.falseBranch
            ? innerScope.innerScopeOf(node.falseBranch)
            : innerScope;
         this.typeCheck(node.condition, innerScope);
         this.typeCheck(node.trueBranch, trueScope);
         if (node.falseBranch) {
            this.typeCheck(node.falseBranch, falseScope);
         }
      } else if (node instanceof WhileLoop) {
         const innerScope = scope.innerScopeOf(node);
         this.typeCheck(node.condition, innerScope);
         if (node.action) {
            this.typeCheck(node.action, innerScope);
         }
      } else if (node instanceof TypeDef) {
         const innerScope = scope.innerScopeOf(node);
         node.fieldDefs.forEach((fd) => {
            let finalType;
            if (fd.defaultValue) {
               this.typeCheck(fd.defaultValue, innerScope);
               const inferredType = this.context.inferencer.infer(
                  fd.defaultValue,
                  innerScope
               );
               finalType = inferredType;
               if (fd.type) {
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
                  const commonType = this.context.inferencer.deduceCommonType(
                     expectedType,
                     inferredType,
                     scope
                  );
                  finalType = commonType;
               }
            }
            if (!finalType && fd.type) {
               finalType = this.context.translator.translate(
                  fd.type,
                  innerScope
               );
            }
            if (finalType) {
               finalType = scope.resolveNamedType(finalType);
            }
            if (!fd.mutable && finalType instanceof StructType) {
               const mutableSubFields = finalType.getMutableFields();
               if (mutableSubFields.length > 0) {
                  this.context.errors.add(
                     `Invariable field '${fd.name}' of '${
                        node.name
                     }' cannot hold a variable value '${finalType.toString()}' with variable fields ${mutableSubFields
                        .map((f) => "'" + f.name + "'")
                        .join(", ")}`,
                     undefined,
                     finalType,
                     fd.position,
                     "Either declare the variability by specifying the field's type as '~" +
                        finalType.toString() +
                        "' or don't use a variable type in this field"
                  );
               }
            }
            if (
               finalType instanceof RoundValueToValueLambdaType &&
               scope.resolveFully(finalType.returnType) instanceof StructType
            ) {
               const mutableSubFields = (
                  scope.resolveFully(finalType.returnType) as StructType
               ).getMutableFields();
               // if (mutableSubFields.length > 0) {
               //    this.context.errors.add(
               //       `Lambda field '${fd.name}' of '${
               //          node.name
               //       }' with invariable return type cannot hold a variable value. Mutable fields = [${mutableSubFields
               //          .map((f) => f.name)
               //          .join(", ")}]`,
               //       undefined,
               //       finalType,
               //       fd.position,
               //       "Either declare the variability by specifying the return type as '~" +
               //          finalType.returnType.toString() +
               //          "' or don't use a lambda returning a variable value in this field"
               //    );
               // }
            }
         });
      } else if (node instanceof BinaryExpression) {
         this.typeCheck(node.left, scope, {
            isWithinCopyStructure: options.isWithinCopyStructure,
         });
         const leftType = this.context.inferencer.infer(node.left, scope);
         this.typeCheck(node.right, scope, {
            firstPartOfIntersection: leftType,
            isWithinCopyStructure:
               options.isWithinCopyStructure || node.operator === "copy",
         });
      } else if (node instanceof Select) {
         this.typeCheck(node.owner, scope);
      } else if (node instanceof TypeCheck) {
         this.typeCheck(node.term, scope);
         this.typeCheck(node.type, scope);
      } else if (node instanceof UnaryOperator) {
         this.typeCheck(node.expression, scope);
      } else if (node instanceof RefinedDef) {
         this.typeCheck(node.lambda, scope);
      } else if (node instanceof Tuple) {
         if (node.isTypeLevel && options.assignedName !== undefined) {
            this.context.errors.add(
               "Cmon man... just declare a custom struct instead of naming a tuple",
               undefined,
               undefined,
               node.position
            );
         }
         if (node.expressions.length > 3) {
            this.context.errors.add(
               "Tuples can only have 2 or 3 elements",
               undefined,
               undefined,
               node.position
            );
         }
         node.expressions.forEach((el) => this.typeCheck(el, scope));
      } else if (node instanceof AppliedKeyword) {
         this.typeCheck(node.param, scope);
      } else {
      }
   }

   typeCheckRoundValueToValueLambda(
      node: RoundValueToValueLambda,
      scope: Scope,
      options: RecursiveResolutionOptions
   ) {
      const innerScope = scope.innerScopeOf(node);
      const returnType =
         node.block.at(BAKED_TYPE) ??
         this.context.inferencer.infer(node.block, innerScope);

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
               undefined,
               new Error()
            );
         }
      }
      if (returnType instanceof UncheckedType) {
         this.context.errors.add(
            `Could not infer return type of recursive lambda ${node.show()}`,
            undefined,
            returnType,
            node.position,
            "Specify the return type explicitly '(...): <Type> -> ...'",
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
      let type = lambdaType;
      // this.context.inferencer.inferRoundValueToValueLambda(
      //    node,
      //    scope,
      //    { typeExpectedInPlace: lambdaType }
      // );
      if (type instanceof RoundValueToValueLambdaType) {
         this.checkLambdaParamsValidity(type.params, scope);
      }
      this.typeCheck(node.block, innerScope);

      if (node.pure) {
         let effects = [
            ...this.findEffects(node.block, false, innerScope, innerScope),
            ...node.params.flatMap((p) =>
               this.findEffects(p, false, scope.innerScopeOf(node), innerScope)
            ),
         ];

         // PURE HANDLING
         //  for (const [error, term] of effects) {
         //     this.context.errors.add(
         //        error + " in a pure lambda body",
         //        undefined,
         //        undefined,
         //        term.position,
         //        `Either declare ${node.show()} as an effectful lambda '(...) ~> ...', or remove the effect.`
         //     );
         //  }
      }

      if (
         type instanceof RoundValueToValueLambdaType &&
         !(type.returnType instanceof MutableType) &&
         !(type.returnType.name === "Nothing")
      ) {
         let effects = [
            ...this.findEffects(node.block, true, innerScope, innerScope),
            ...node.params.flatMap((p) =>
               this.findEffects(p, true, scope.innerScopeOf(node), innerScope)
            ),
         ];
         //  for (const [error, term] of effects) {
         //     this.context.errors.add(
         //        error +
         //           " in lambda '" +
         //           node.show() +
         //           "' that supposedly returns an invariable value.",
         //        undefined,
         //        undefined,
         //        term.position,
         //        "You must mark the return type of the lambda with ~<Type>, or not use a variable value"
         //     );
         //  }
         //  const returnType = scope.resolveNamedType(type.returnType);
         // if (returnType.isMutable()) {
         //    this.context.errors.add(
         //       "Return type of lambda '" +
         //          node.show() +
         //          "' is a mutable type, yet the lambda's signature doesn't reflect that",
         //       undefined,
         //       undefined,
         //       node.block.position
         //    );
         // }
      }
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

   typeCheckSquareApply(apply: Call, scope: Scope) {
      const translator = this.context.translator;
      const appliedParamTypes = apply.args.map(([n, t]) =>
         translator.translate(t, scope)
      );
      if (
         apply.callee instanceof Identifier &&
         apply.callee.isTypeIdentifier()
      ) {
         try {
            const testCalleeIsType = scope.resolveFully(
               this.context.translator.translate(apply.callee, scope)
            );
            if (testCalleeIsType instanceof SquareTypeToTypeLambdaType) {
               const typeMap = GenericTypeMap.fromPairs(
                  testCalleeIsType.paramTypes,
                  appliedParamTypes
               );
               this.typeCheckSquareParams(
                  testCalleeIsType.paramTypes,
                  typeMap,
                  apply.position,
                  scope
               );
               return;
            }
         } catch (e) {
            // It's ok, it wasn't a type lambda
            console.error(e);
         }
      }
      const calleeType = scope.resolveNamedType(
         this.context.inferencer.infer(apply.callee, scope)
      );
      if (!(calleeType instanceof SquareTypeToValueLambdaType)) {
         throw new Error(
            "Cannot call non-square lambda with square parameters at " +
               apply.callee.show() +
               ", was " +
               calleeType.toString()
         );
      }
      const typeMap = GenericTypeMap.fromPairs(
         calleeType.paramTypes,
         appliedParamTypes
      );

      this.typeCheckSquareParams(
         calleeType.paramTypes,
         typeMap,
         apply.position,
         scope
      );
      // let i = 0;
      // for (let paramType of calleeType.paramTypes) {
      //    if (!paramType.extendedType) {
      //       continue;
      //    }
      //    const gottenParamType = this.context.translator.translate(
      //       apply.typeArgs[i],
      //       scope
      //    );
      //    if (!gottenParamType.isAssignableTo(paramType.extendedType, scope)) {
      //       this.context.errors.add(
      //          `Parameter ${paramType.name} of Square Apply`,
      //          paramType.extendedType,
      //          gottenParamType,
      //          apply.position
      //       );
      //    }
      //    i++;
      // }
   }

   typeCheckSquareParams(
      expectedParams: GenericNamedType[],
      appliedParams: GenericTypeMap,
      position: TokenPos | undefined,
      scope: Scope
   ) {
      let i = 0;
      for (let paramType of expectedParams) {
         const [name, gottenParamType] = appliedParams.at(i);
         i++;
         if (
            paramType.extendedType &&
            !gottenParamType.isAssignableTo(paramType.extendedType, scope)
         ) {
            this.context.errors.add(
               `Parameter Type ${paramType.name} of Apply`,
               paramType.extendedType,
               gottenParamType,
               position
            );
         }
      }
   }

   typeCheckApply(
      apply: Call,
      scope: Scope,
      options: RecursiveResolutionOptions
   ) {
      this.typeCheck(apply.callee, scope);
      let typeSymbol = this.context.inferencer.infer(apply.callee, scope);
      let mappings: { [_: string]: Type } = {};
      if (
         apply.callee instanceof Identifier &&
         apply.callee.isTypeIdentifier()
      ) {
         typeSymbol = scope.lookupType(apply.callee.value).typeSymbol;
      }
      let constructor = typeSymbol.buildConstructor();
      let isStructConstructor = false;
      if (constructor instanceof RoundValueToValueLambdaType) {
         typeSymbol = constructor;
         isStructConstructor = true;
      }

      if (
         typeSymbol instanceof SquareTypeToValueLambdaType &&
         typeSymbol.returnType instanceof RoundValueToValueLambdaType
      ) {
         const applyArgs = apply.getTypeArgs();
         if (!applyArgs) {
            this.context.errors.add("Unchecked square apply");
            return;
         }

         this.typeCheckSquareParams(
            typeSymbol.paramTypes,
            applyArgs,
            apply.position,
            scope
         );

         typeSymbol = scope.resolveGenericTypes(
            typeSymbol.returnType,
            applyArgs
         );
      }

      if (typeSymbol instanceof RoundValueToValueLambdaType) {
         const params = typeSymbol.params;
         const hasThis = params.length > 0 && params[0].name === "self";
         apply.args.forEach((p, i) => {
            this.typeCheck(p[1], scope, {
               typeExpectedInPlace: params[i + (hasThis ? 1 : 0)]?.type,
            });
         });

         if (
            params[0] &&
            params[0].type instanceof AppliedGenericType &&
            params[0].type.callee.name === "Seq"
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
                        undefined,
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
            options?.isWithinCopyStructure === true &&
               apply.callee instanceof Identifier &&
               apply.callee.isTypeIdentifier()
         );
         apply.paramOrder = paramOrder;
      }
   }

   findEffects(
      node: Statement,
      onlyCaptures: boolean,
      scope: Scope,
      nearestFunctionScope: Scope
   ): [string, Term][] {
      if (node instanceof AppliedKeyword && node.keyword !== "unchecked") {
         return this.findEffects(
            node.param,
            onlyCaptures,
            scope,
            nearestFunctionScope
         );
      } else if (node instanceof Block) {
         return node.statements.flatMap((statement) =>
            this.findEffects(
               statement,
               onlyCaptures,
               scope.innerScopeOf(node),
               nearestFunctionScope
            )
         );
      } else if (node instanceof IfStatement) {
         const ifScope = scope.innerScopeOf(node);
         return [
            ...this.findEffects(
               node.condition,
               onlyCaptures,
               ifScope,
               nearestFunctionScope
            ),
            ...this.findEffects(
               node.trueBranch,
               onlyCaptures,
               ifScope.innerScopeOf(node.trueBranch),
               nearestFunctionScope
            ),
            ...(node.falseBranch
               ? this.findEffects(
                    node.falseBranch,
                    onlyCaptures,
                    node.falseBranch
                       ? ifScope.innerScopeOf(node.falseBranch)
                       : ifScope,
                    nearestFunctionScope
                 )
               : []),
         ];
      } else if (node instanceof WhileLoop) {
         const ifScope = scope.innerScopeOf(node);
         return [
            ...this.findEffects(
               node.condition,
               onlyCaptures,
               ifScope,
               nearestFunctionScope
            ),
            ...this.findEffects(
               node.action,
               onlyCaptures,
               ifScope,
               nearestFunctionScope
            ),
         ];
      } else if (node instanceof BinaryExpression) {
         return [
            ...this.findEffects(
               node.left,
               onlyCaptures,
               scope,
               nearestFunctionScope
            ),
            ...this.findEffects(
               node.right,
               onlyCaptures,
               scope,
               nearestFunctionScope
            ),
         ];
      } else if (node instanceof UnaryOperator) {
         return [
            ...this.findEffects(
               node.expression,
               onlyCaptures,
               scope,
               nearestFunctionScope
            ),
         ];
      } else if (node instanceof Assignment) {
         return [
            ...(node.isDeclaration
               ? []
               : this.findEffects(
                    node.lhs,
                    onlyCaptures,
                    scope,
                    nearestFunctionScope
                 )),
            ...(node.value
               ? this.findEffects(
                    node.value,
                    onlyCaptures,
                    scope,
                    nearestFunctionScope
                 )
               : []),
         ];
      } else if (node instanceof Change) {
         const result = [
            ...this.findEffects(
               node.value,
               onlyCaptures,
               scope,
               nearestFunctionScope
            ),
         ];
         if (node.lhs instanceof Identifier) {
            const isSymbolFromHere = scope.hasSymbol(
               node.lhs.value,
               nearestFunctionScope
            );
            if (isSymbolFromHere) {
               return result;
            }
         }
         if (!onlyCaptures) {
            result.push(["Setting variable '" + node.lhs.show() + "'", node]);
         }
         return result;
      } else if (node instanceof Select) {
         const result = [
            ...this.findEffects(
               node.owner,
               onlyCaptures,
               scope,
               nearestFunctionScope
            ),
         ];
         const field = this.context.inferencer.findField(
            this.context.inferencer.infer(node.owner, scope),
            node.field,
            scope
         );
         if (
            onlyCaptures &&
            field &&
            (field.mutable || field.type instanceof MutableType)
         ) {
            result.push([
               "Using outside mutable value '" + node.show() + "'",
               node,
            ]);
         }
         return result;
      } else if (node instanceof Cast) {
         return [
            ...this.findEffects(
               node.expression,
               onlyCaptures,
               scope,
               nearestFunctionScope
            ),
         ];
      } else if (node instanceof Call) {
         const type = this.context.inferencer.infer(node.callee, scope);
         if (!onlyCaptures) {
            const results = node.args.flatMap((arg) =>
               this.findEffects(
                  arg[1],
                  onlyCaptures,
                  scope,
                  nearestFunctionScope
               )
            );
            if (type instanceof RoundValueToValueLambdaType && !type.pure) {
               results.push([
                  "Calling lambda '" + node.callee.show() + "'",
                  node,
               ]);
            }
            if (type instanceof SquareTypeToValueLambdaType && !type.pure) {
               results.push([
                  "Calling square lambda '" + node.callee.show() + "'",
                  node,
               ]);
            }
            if (
               type instanceof SquareTypeToValueLambdaType &&
               type.returnType instanceof RoundValueToValueLambdaType &&
               !type.returnType.pure
            ) {
               results.push([
                  "Calling square lambda with round parens '" +
                     node.callee.show() +
                     "'",
                  node,
               ]);
            }

            return results;
         } else {
            const results = node.args.flatMap((arg) =>
               this.findEffects(
                  arg[1],
                  onlyCaptures,
                  scope,
                  nearestFunctionScope
               )
            );
            if (
               type instanceof RoundValueToValueLambdaType &&
               type.returnType instanceof MutableType
            ) {
               results.push([
                  "Calling lambda '" + node.callee.show() + "'",
                  node,
               ]);
            }
            if (
               type instanceof SquareTypeToValueLambdaType &&
               type.returnType instanceof MutableType
            ) {
               results.push([
                  "Calling square lambda '" + node.callee.show() + "'",
                  node,
               ]);
            }

            return results;
         }
      } else if (node instanceof Identifier) {
         try {
            const symbol = node.isTypeIdentifier()
               ? scope.lookupType(node.value)
               : scope.lookup(node.value);
            if (
               symbol.isMutable &&
               onlyCaptures &&
               !scope.hasSymbol(node.value, scope.parent)
            ) {
               return [["Variable value '" + node.value + "' present", node]];
            } else {
               return [];
            }
         } catch (e) {
            return [];
         }
      } else if (node instanceof Group) {
         return this.findEffects(
            node.value,
            onlyCaptures,
            scope,
            nearestFunctionScope
         );
      }

      return [];
   }

   typeCheckLambdaCall(
      term: Call,
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
      if (thisParam?.name !== "self") {
         thisParam = undefined;
      }
      let checkedThis = false;
      if (thisParam && !(term.callee instanceof Select)) {
         checkedThis = true;
         if (!options.firstPartOfIntersection) {
            if (!term.bakedInThis) {
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
            }
         } else {
            if (
               !options.firstPartOfIntersection.isAssignableTo(
                  thisParam.type,
                  scope
               ) &&
               !term.bakedInThis
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
         ...expectedParams.filter((f) => f.name !== "self"),
      ];
      let paramOrder: [number, number][] = [];
      let hasThisParamIncrement =
         expectedParams[0] && expectedParams[0].name === "self" ? 1 : 0;

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
            // if (!calleeType.isAssignableTo(expectedThisType, scope)) {
            //    this.context.errors.add(
            //       `Call target ('this') of lambda ${term.callee.field}`,
            //       expectedThisType,
            //       calleeType,
            //       term.position
            //    );
            // }
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
               "Applying too many parameters to lambda " + termName,
               undefined,
               undefined,
               term.position,
               `Expected ${expectedParams.length} params, got ${
                  i + hasThisParamIncrement
               }.`
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
            `Lambda ${termName} didn't have all of its non-optional parameters fulfilled, ${unfulfilledExpectedParams.length} params unfulfilled`,
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
      message: string;
      expectedType?: Type;
      insertedType?: Type;
      position?: TokenPos;
      hint?: string;
      errorForStack?: Error;
   }[];
   context: TypePhaseContext;
   constructor(context: TypePhaseContext) {
      this.context = context;
      this.errors = [];
   }

   add(
      message: string,
      expectedType?: Type,
      insertedType?: Type,
      position?: TokenPos,
      hint?: string,
      errorForStack?: Error
   ) {
      for (let error of this.errors) {
         if (
            error.message === message &&
            error.hint === hint &&
            (expectedType === undefined ||
               expectedType.toString() === error.expectedType?.toString()) &&
            (insertedType === undefined ||
               insertedType.toString() === error.insertedType?.toString()) &&
            (position === undefined ||
               position.start.toString() === error.position?.start.toString())
         ) {
            return;
         }
      }
      this.errors.push({
         message,
         expectedType,
         insertedType,
         position,
         hint,
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
                     `- ${e.message} @ ${this.context.fileName}:${
                        e.position?.start.line
                     }:${e.position?.start.column}${
                        e.expectedType
                           ? `\n  > Expected '${e.expectedType?.toString()}'`
                           : ""
                     }${e.insertedType ? `\n  > Got '${e.insertedType}'` : ""}${
                        e.hint ? `\n  > ${e.hint}` : ""
                     }`
               )
               .join("\n");
         return message;
      }
   }
}
