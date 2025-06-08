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
import { RecursiveResolutionOptions, Symbol } from "./Scope";
import {
   UncheckedType,
   MutableType,
   PrimitiveType,
   SingletonType,
   Nothing,
} from "./Types";
import { Identifier, TypeCheck } from "./Parser";
import {
   AppliedGenericType,
   GenericNamedType,
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
            this.context.logs.error({
               message: `Setting an immutable value '${node.lhs.value}'`,
               position: node.position,
               hint: `Either declare '${
                  node.lhs.value
               }' as a variable type '~${symbol.typeSymbol.toString()}', or don't mutate it here.`,
            });
         }
      } else if (node.lhs instanceof Select) {
         if (!node.lhs.isBeingTreatedAsIdentifier) {
            let ownerType = scope.resolveNamedType(
               this.context.inferencer.infer(node.lhs.owner, scope)
            ) as StructType;
            let fieldType = this.context.inferencer.findField(
               ownerType,
               node.lhs.field,
               scope
            );
            if (
               !fieldType?.mutable &&
               !(fieldType?.type instanceof MutableType)
            ) {
               this.context.logs.error({
                  message: `Setting an immutable field '${node.lhs.show()}'`,
                  position: node.position,
                  hint: `Either declare '${
                     fieldType?.name
                  }' as a variable type '~${fieldType?.toString()}', or don't mutate it here.`,
               });
            }
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

         this.context.logs.error({
            message: `Setting of variable ${node.lhs.show()}`,
            expectedType: leftType,
            insertedType: rightType,
            position: node.position,
         });
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
         this.typeCheckSquareApply(node, scope, options);
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
         const conditionType = this.context.inferencer.infer(
            node.condition,
            innerScope
         );
         if (!conditionType.isAssignableTo(PrimitiveType.Boolean, innerScope)) {
            this.context.logs.error({
               message: "Condition of if statement: " + node.condition.show(),
               expectedType: PrimitiveType.Boolean,
               insertedType: conditionType,
               position: node.condition.position,
            });
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
                     this.context.logs.error({
                        message: "Default value of field " + fd.name,
                        expectedType,
                        insertedType: inferredType,
                        position: fd.position,
                     });
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
                  //   this.context.logs.warn({
                  //      message: `Invariable field '${fd.name}' of '${
                  //         node.name
                  //      }' shouldn't hold a variable value '${finalType.toString()}' with variable fields ${mutableSubFields
                  //         .map((f) => "'" + f.name + "'")
                  //         .join(", ")}`,
                  //      insertedType: finalType,
                  //      position: fd.position,
                  //      hint:
                  //         "Either declare the variability by specifying the field's type as '~" +
                  //         finalType.toString() +
                  //         "' or don't use a variable type in this field",
                  //   });
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
         if (
            !node.isBeingTreatedAsIdentifier &&
            !scope.hasSymbol(node.nameAsSelectOfIdentifiers() ?? "")
         ) {
            this.typeCheck(node.owner, scope);
         }
      } else if (node instanceof TypeCheck) {
         this.typeCheck(node.term, scope);
         this.typeCheck(node.type, scope);
      } else if (node instanceof UnaryOperator) {
         this.typeCheck(node.expression, scope);
      } else if (node instanceof RefinedDef) {
         this.typeCheck(node.lambda, scope);
      } else if (node instanceof Tuple) {
         if (node.isTypeLevel && options.assignedName !== undefined) {
            this.context.logs.error({
               message:
                  "Cmon man... just declare a custom struct instead of naming a tuple",
               position: node.position,
            });
         }
         if (node.expressions.length > 3) {
            this.context.logs.error({
               message: "Tuples can only have 2 or 3 elements",
               position: node.position,
            });
         }
         node.expressions.forEach((el) => this.typeCheck(el, scope));
      } else if (node instanceof AppliedKeyword) {
         this.typeCheck(node.param, scope);
      } else if (node instanceof Identifier) {
         const shouldError = node.isTypeIdentifier()
            ? !scope.hasTypeSymbol(node.value)
            : !scope.hasSymbol(node.value);
         if (
            shouldError &&
            !["Nothing", "Anything", "String", "Boolean", "Number"].includes(
               node.value
            )
         ) {
            this.context.logs.error({
               message: `Could not find type '${node.value}'`,
               position: node.position,
            });
         }
      } else {
      }
   }

   typeCheckRoundValueToValueLambda(
      node: RoundValueToValueLambda,
      scope: Scope,
      options: RecursiveResolutionOptions
   ) {
      const innerScope = scope.innerScopeOf(node);
      let returnType =
         node.block.at(BAKED_TYPE) ??
         this.context.inferencer.infer(node.block, innerScope, {
            allowsSingletonType: node.specifiedType !== undefined,
         });

      if (
         node.isTypeLevel ||
         (this.context.inferencer.isCapitalized(node.name ?? "c") &&
            node.translatedType)
      ) {
         let i = 0;
         for (const param of (
            node.translatedType as RoundValueToValueLambdaType
         ).params) {
            if (param.defaultValue) {
               this.context.logs.error({
                  message: `Param ${
                     param.name ?? i++
                  } of type ${node.show()} cannot have a default value`,
                  position: node.position,
               });
            }
         }
      }

      if (node.specifiedType) {
         const explicitType = this.context.translator.translate(
            node.specifiedType,
            innerScope
         );
         if (!returnType.isAssignableTo(explicitType, scope)) {
            this.context.logs.error({
               message: `Return type of lambda`,
               expectedType: explicitType,
               insertedType: returnType,
               position: node.position,
            });
         }
      }
      if (returnType instanceof UncheckedType) {
         this.context.logs.error({
            message: `Could not infer return type of recursive lambda ${node.show()}`,
            insertedType: returnType,
            position: node.position,
            hint: "Specify the return type explicitly '(...): <Type> -> ...'",
         });
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
            this.context.logs.error({
               message: "Cannot define nameless parameters after named ones ",
            });
         }
         if (hitDefault && !param.defaultValue) {
            this.context.logs.error({
               message:
                  "Cannot define parameter without default value, after ones with default values",
            });
         }
      }
   }

   typeCheckSquareTypeToValueLambda(
      node: SquareTypeToValueLambda,
      scope: Scope
   ) {
      const innerScope = scope.innerScopeOf(node);
      node.parameterTypes.forEach((p) => this.typeCheck(p, innerScope));
      this.typeCheck(node.block, innerScope);
   }

   typeCheckSquareApply(
      apply: Call,
      scope: Scope,
      options: RecursiveResolutionOptions
   ) {
      const translator = this.context.translator;
      const appliedParamTypes = apply.args.map(([n, t]) =>
         translator.translate(t, scope)
      );

      apply.args.forEach(([name, term]) => {
         console.log("Typechecking square apply term " + term.show());
         this.typeCheck(term, scope, {
            isTypeLevel: options.isTypeLevel,
            allowsSingletonType: options.allowsSingletonType,
         });
      });
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
            this.context.logs.error({
               message: `Parameter Type ${paramType.name} of Apply`,
               expectedType: paramType.extendedType,
               insertedType: gottenParamType,
               position,
            });
         }
      }
   }

   typeCheckApply(
      apply: Call,
      scope: Scope,
      options: RecursiveResolutionOptions
   ) {
      this.typeCheck(apply.callee, scope);
      if (apply.bakedInThis) {
         this.typeCheck(apply.bakedInThis, scope);
      }
      let typeSymbol = scope.resolveNamedType(
         this.context.inferencer.infer(apply.callee, scope)
      );
      let mappings: { [_: string]: Type } = {};
      if (
         apply.callee instanceof Identifier &&
         apply.callee.isTypeIdentifier()
      ) {
         typeSymbol = scope.resolveNamedType(
            scope.lookupType(apply.callee.value).typeSymbol
         );
         let constructor = typeSymbol.buildConstructor(scope, this.context);
         if (constructor instanceof RoundValueToValueLambdaType) {
            typeSymbol = constructor;
         }
      }

      if (
         typeSymbol instanceof SquareTypeToValueLambdaType &&
         typeSymbol.returnType instanceof RoundValueToValueLambdaType
      ) {
         const applyArgs = apply.getTypeArgs();
         if (!applyArgs) {
            this.context.logs.error({ message: "Unchecked square apply" });
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
            apply.args[0] &&
            params[0].type instanceof AppliedGenericType &&
            params[0].type.callee.name === "Seq"
         ) {
            const firstAppliedParamType = this.context.inferencer.infer(
               apply.args[0][1],
               scope
            );
            if (
               params[0].name === "self" &&
               firstAppliedParamType.name !== "Seq"
            ) {
               return;
            }
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
                     this.context.logs.error({
                        message: `Parameter ${i} of varargs ${
                           apply.callee instanceof Identifier
                              ? apply.callee.value
                              : "Anonymous function"
                        }`,
                        expectedType,
                        insertedType: gottenType,
                        position: apply.position,
                     });
                  }
               });
               apply.takesVarargs = true;
            }
            return;
         }

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
      } else {
         // Expecting copy 'obj { field = ... }'
         for (const param of apply.args) {
            const field = this.context.inferencer.findField(
               typeSymbol,
               param[0],
               scope
            );
            const fieldType = field?.type;
            const appliedType = this.context.inferencer.infer(param[1], scope);
            if (!fieldType || !appliedType.isAssignableTo(fieldType, scope)) {
               this.context.logs.error({
                  message: `Invalid type of field in copy: '${param[0]}'`,
                  expectedType: fieldType ?? Nothing,
                  insertedType: appliedType,
                  position: apply.position,
               });
            }
         }
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
         if (scope.hasSymbol(node.nameAsSelectOfIdentifiers() ?? "")) {
            return result;
         }
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
               this.context.logs.error({
                  message:
                     "Expected left-side of intersection (&) '" +
                     (term.callee instanceof Identifier
                        ? term.callee.value
                        : "Anonymous function") +
                     "'",
                  expectedType: thisParam.type,
                  insertedType: options.firstPartOfIntersection,
                  position: term.position,
                  hint: `You must apply it like ${
                     thisParam.type
                  } { ... } & ${term.callee.show()} { ... }`,
               });
            }
         } else {
            if (
               !options.firstPartOfIntersection.isAssignableTo(
                  thisParam.type,
                  scope
               ) &&
               !term.bakedInThis
            ) {
               this.context.logs.error({
                  message:
                     "Expected left-side of intersection (&) '" +
                     (term.callee instanceof Identifier
                        ? term.callee.value
                        : "Anonymous function") +
                     "'",
                  expectedType: thisParam.type,
                  insertedType: options.firstPartOfIntersection,
                  position: term.position,
                  hint: `You must apply it like ${
                     thisParam.type
                  } { ... } & ${term.callee.show()} { ... }`,
               });
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
            this.context.logs.error({
               message:
                  "Method with 'this' as a parameter must be called on the field of a struct",
               expectedType: expectedThisType,
               position: term.position,
            });
         } else {
            const calleeType = this.context.inferencer.infer(
               term.callee.owner,
               scope
            );
            if (!calleeType.isAssignableTo(expectedThisType, scope)) {
               this.context.logs.error({
                  message: `Call target ('self') of lambda ${term.callee.field}`,
                  expectedType: expectedThisType,
                  insertedType: calleeType,
                  position: term.position,
               });
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
            this.context.logs.error({
               message:
                  "Cannot use unnamed parameters after named ones at " +
                  termName,
               position: applyArg[1].position,
            });
         }
         if (applyArgName && fulfilledNamedParams.has(applyArgName)) {
            this.context.logs.error({
               message: `Parameter ${applyArgName} of ${termName} was already fulfilled perviously, without an explicit name`,
               position: applyArg[1].position,
            });
            continue;
         }

         const expectedParam = applyArgName
            ? expectedParams.find((p) => p.name === applyArgName)
            : expectedParams[i + hasThisParamIncrement];
         if (!expectedParam) {
            this.context.logs.error({
               message: "Applying too many parameters to lambda " + termName,
               position: term.position,
               hint: `Expected ${expectedParams.length} params, got ${
                  i + hasThisParamIncrement
               }.`,
            });
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
            this.context.logs.error({
               message: `Parameter '${
                  expectedParam.name || `[${i}]`
               }' of '${termName}'`,
               expectedType,
               insertedType: appliedType,
               position: applyArg[1].position,
            });
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
         this.context.logs.error({
            message: `Lambda ${termName} didn't have all of its non-optional parameters fulfilled, ${unfulfilledExpectedParams.length} params unfulfilled`,
            position: term.position,
         });
      }

      return paramOrder;
   }
}

type CompilerMessage = {
   message: string;
   expectedType?: Type;
   insertedType?: Type;
   position?: TokenPos;
   hint?: string;
   errorForStack?: Error;
};

export class CompilerLogs {
   errors: CompilerMessage[];
   warnings: CompilerMessage[];
   context: TypePhaseContext;
   constructor(context: TypePhaseContext) {
      this.context = context;
      this.errors = [];
      this.warnings = [];
   }

   private add(list: CompilerMessage[], inputMessage: CompilerMessage) {
      for (let message of list) {
         if (
            message.message === inputMessage.message &&
            message.hint === inputMessage.hint &&
            (inputMessage.expectedType === undefined ||
               inputMessage.expectedType.toString() ===
                  message.expectedType?.toString()) &&
            (inputMessage.insertedType === undefined ||
               inputMessage.insertedType.toString() ===
                  message.insertedType?.toString()) &&
            (inputMessage.position === undefined ||
               inputMessage.position.start.toString() ===
                  message.position?.start.toString())
         ) {
            return;
         }
      }
      list.push(inputMessage);
   }

   error(message: CompilerMessage) {
      this.add(this.errors, message);
   }

   warn(message: CompilerMessage) {
      this.add(this.warnings, message);
   }

   getMessages(label: string, list: CompilerMessage[]) {
      if (list.length > 0) {
         const message = list
            .map(
               (e) =>
                  `[${label}] ${e.message} @ ${this.context.fileName}:${
                     e.position?.start.line
                  }:${e.position?.start.column}${
                     e.expectedType
                        ? `\n       > Expected '${e.expectedType?.toString()}' - ${
                             e.expectedType?.tag
                          }`
                        : ""
                  }${
                     e.insertedType
                        ? `\n       > Got '${e.insertedType}' - ${e.insertedType?.tag}`
                        : ""
                  }${e.hint ? `\n       > ${e.hint}` : ""}`
            )
            .join("\n");
         return message;
      }
   }

   getErrors(showStack = true) {
      return this.getMessages("ERROR", this.errors);
   }

   getWarnings(showStack = true) {
      return this.getMessages("WARN", this.warnings);
   }
}
