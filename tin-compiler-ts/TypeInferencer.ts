import {
   Nothing,
   RefinedType,
   NamedType,
   PrimitiveType,
   IntersectionType,
   Never,
} from "./Types";
import {
   BAKED_TYPE,
   IN_RETURN_BRANCH,
   Optional,
   RefinedDef,
   Tuple,
} from "./Parser";
import { UnionType } from "./Types";
import { GenericTypeMap, walkTerms } from "./Scope";
import {
   AppliedKeyword,
   Assignment,
   BinaryExpression,
   Block,
   Cast,
   DataDef,
   Group,
   Identifier,
   IfStatement,
   Literal,
   Call,
   RoundValueToValueLambda,
   Select,
   SquareTypeToTypeLambda,
   SquareTypeToValueLambda,
   Statement,
   Term,
   TypeDef,
   UnaryOperator,
   WhileLoop,
} from "./Parser";
import {
   RecursiveResolutionOptions,
   Scope,
   Symbol,
   TypePhaseContext,
} from "./Scope";
import {
   Any,
   AnyType,
   AppliedGenericType,
   GenericNamedType,
   LiteralType,
   MutableType,
   OptionalType,
   ParamType,
   RoundValueToValueLambdaType,
   SquareTypeToTypeLambdaType,
   SquareTypeToValueLambdaType,
   StructType,
   ThisType,
   Type,
   TypeOfTypes,
   UncheckedType,
} from "./Types";

export class TypeInferencer {
   context: TypePhaseContext;
   constructor(context: TypePhaseContext) {
      this.context = context;
   }

   deduceCommonType(type1: Type, type2: Type, scope: Scope): Type {
      if (type1 === Nothing) {
         return new OptionalType(type2);
      }
      if (type2 === Nothing) {
         return new OptionalType(type1);
      }
      if (type1 === Never) {
         return type2;
      }
      if (type2 === Never) {
         return type1;
      }
      if (type1 instanceof AnyType) {
         return type2;
      }
      if (type2 instanceof AnyType) {
         return type1;
      }
      if (type1.isAssignableTo(type2, scope)) {
         return type2;
      }
      if (type2.isAssignableTo(type1, scope)) {
         return type1;
      }
      return new UnionType(type1, type2);
   }

   private buildCache = new Map<string, Type>();
   infer(
      node: Term,
      scope: Scope,
      options: RecursiveResolutionOptions = {}
   ): Type {
      const cachedString = `${node.id}.${scope.id}.${scope.iteration}`;
      const cachedType = this.buildCache.get(cachedString);
      //   const bakedType = node.at(BAKED_TYPE);
      //   if (bakedType !== undefined) {
      //      return bakedType;
      //   }
      if (cachedType) {
         return cachedType;
      }

      let inferredType: Type;
      switch (node.tag) {
         case "Literal":
            inferredType = this.inferLiteral(node as Literal, scope, options);
            break;
         case "Identifier":
            inferredType = this.inferIdentifier(
               node as Identifier,
               scope,
               options
            );
            break;
         case "Optional":
            inferredType = this.infer((node as Optional).expression, scope);
            if (inferredType instanceof OptionalType) {
               inferredType = inferredType.type;
            }
            if (inferredType instanceof UnionType) {
               if (inferredType.left.isAssignableTo(Nothing, scope)) {
                  inferredType = inferredType.right;
               } else if (inferredType.right.isAssignableTo(Nothing, scope)) {
                  inferredType = inferredType.left;
               } else if (
                  inferredType.left.isAssignableTo(
                     new NamedType("Error"),
                     scope
                  )
               ) {
                  inferredType = inferredType.right;
               } else if (
                  inferredType.right.isAssignableTo(
                     new NamedType("Error"),
                     scope
                  )
               ) {
                  inferredType = inferredType.left;
               }
            }
            break;
         case "IfStatement":
            inferredType = this.inferIfStatemnet(node as IfStatement, scope);
            break;
         case "BinaryExpression":
            inferredType = this.inferBinaryExpression(
               node as BinaryExpression,
               scope,
               options
            );
            break;
         case "RoundValueToValueLambda":
            inferredType = this.inferRoundValueToValueLambda(
               node as RoundValueToValueLambda,
               scope,
               options
            );
            break;
         case "SquareTypeToValueLambda":
            if (!(node instanceof SquareTypeToValueLambda)) {
               throw new Error("Bad type");
            }
            inferredType = this.inferSquareTypeToValueLambda(node, scope);
            break;
         case "SquareTypeToTypeLambda":
            if (!(node instanceof SquareTypeToTypeLambda)) {
               throw new Error("Bad type");
            }
            inferredType = this.inferSquareTypeToTypeLambda(node, scope);
            break;
         case "RoundTypeToTypeLambda":
            inferredType = new TypeOfTypes();
            break;
         case "Block":
            inferredType = this.inferBlock(node as Block, scope, options);
            break;
         case "Call":
            if ((node as Call).kind === "SQUARE") {
               inferredType = this.inferSquareApply(
                  node as Call,
                  scope,
                  options
               );
            } else if ((node as Call).kind === "ROUND") {
               inferredType = this.inferRoundApply(
                  node as Call,
                  scope,
                  options
               );
            } else {
               inferredType = this.inferCurlyCall(node as Call, scope, options);
            }
            break;
         case "Select":
            inferredType = this.inferSelect(node as Select, scope, options);
            break;
         case "TypeDef":
            inferredType = this.inferTypeDef(node as TypeDef, scope);
            break;
         case "Change":
            inferredType = Any;
            break;
         case "DataDef":
            inferredType = this.inferData(node as DataDef, scope);
            break;
         case "Assignment":
            inferredType = Nothing;
            break;
         case "TypeCheck":
            inferredType = PrimitiveType.Boolean;
            break;
         case "Cast":
            this.infer((node as Cast).expression, scope); // for building purposes
            inferredType = this.context.translator.translate(
               (node as Cast).type,
               scope
            );
            scope.resolveNamedType(inferredType);
            break;
         case "WhileLoop":
            inferredType = Nothing;
            break;
         case "Group":
            inferredType = this.infer((node as Group).value, scope) as any;
            break;
         case "AppliedKeyword":
            inferredType = this.infer(
               (node as AppliedKeyword).param,
               scope
            ) as any;
            break;
         case "UnaryOperator":
            const unary = node as UnaryOperator;
            const expressionType: Type = this.infer(
               (node as UnaryOperator).expression,
               scope,
               {
                  expectsBroadenedType: options.expectsBroadenedType,
                  isTypeLevel: options.isTypeLevel,
                  assignedName: options.assignedName,
               }
            );
            if (unary.operator == "var") {
               inferredType = new MutableType(expressionType);
               break;
            } else {
               if (expressionType instanceof TypeOfTypes) {
                  return expressionType;
               } else if (
                  unary.operator === "-" &&
                  expressionType.isAssignableTo(PrimitiveType.Number, scope)
               ) {
                  return PrimitiveType.Number;
               } else if (
                  unary.operator === "!" &&
                  expressionType === PrimitiveType.Boolean
               ) {
                  return PrimitiveType.Boolean;
               }
            }
            throw new Error("Unexpected operator " + unary.operator);
            break;
         case "RefinedDef":
            inferredType = new TypeOfTypes();
            break;
         case "Tuple":
            const tuple = node as Tuple;
            inferredType = new AppliedGenericType(
               new NamedType("Tuple" + tuple.expressions.length),
               tuple.expressions.map((el) => this.infer(el, scope))
            );
            break;
         default:
            throw new Error(
               "Could not infer '" + node.tag + "' - " + node.position
            );
            inferredType = new Type(); // Unknown type by default
      }
      this.buildCache.set(cachedString, inferredType);
      node.inferredType = inferredType;
      inferredType.ast = node;
      return inferredType;
   }

   inferData(node: DataDef, scope: Scope) {
      return this.context.translator.translate(
         new TypeDef(node.fieldDefs),
         scope
      );
   }

   inferIfStatemnet(node: IfStatement, scope: Scope): Type {
      const innerScope = scope.innerScopeOf(node, true);
      const trueBranchType = this.infer(
         node.trueBranch,
         innerScope.innerScopeOf(node.trueBranch, true)
      );
      const falseBranch = node.falseBranch
         ? innerScope.innerScopeOf(node.falseBranch, true)
         : innerScope;
      let falseBranchType: Type = Nothing;
      if (node.falseBranch !== undefined) {
         falseBranchType = this.infer(node.falseBranch, falseBranch);
      }
      return this.deduceCommonType(trueBranchType, falseBranchType, scope);
   }

   inferTypeDef(node: TypeDef, scope: Scope): Type {
      return new TypeOfTypes();
   }

   inferSquareTypeToTypeLambda(
      node: SquareTypeToTypeLambda,
      scope: Scope
   ): Type {
      const innerScope = scope.innerScopeOf(node);
      return new SquareTypeToTypeLambdaType(
         node.parameterTypes.map((p) => {
            const paramType = this.context.translator.translate(p, innerScope);
            if (paramType instanceof GenericNamedType) {
               return paramType;
            } else {
               throw new Error(
                  "Expected Generic type as parameter of square lambda, but it wasn't,"
               );
            }
         }),
         this.context.translator.translate(node.returnType, innerScope)
      );
   }

   inferSquareTypeToValueLambda(
      node: SquareTypeToValueLambda,
      scope: Scope
   ): Type {
      const innerScope = scope.innerScopeOf(node);
      return new SquareTypeToValueLambdaType(
         node.parameterTypes.map((p) => {
            const paramType = this.context.translator.translate(p, innerScope);
            if (paramType instanceof GenericNamedType) {
               return paramType;
            } else {
               throw new Error(
                  "Expected Generic type as parameter of square lambda, but it wasn't,"
               );
            }
         }),
         this.infer(node.block, innerScope),
         node.pure
      );
   }

   inferSquareApply(
      node: Call,
      scope: Scope,
      options: RecursiveResolutionOptions
   ): Type {
      let calleeType;
      //   this.handleSquareExtensionSearch(node, scope);
      try {
         calleeType = scope.resolveNamedType(
            node.callee instanceof Identifier && node.callee.isTypeIdentifier()
               ? this.context.translator.translate(node.callee, scope)
               : this.infer(node.callee, scope)
         );
         const constructor = scope
            .resolveNamedType(calleeType)
            .buildConstructor(scope, this.context);
         if (constructor instanceof SquareTypeToValueLambdaType) {
            calleeType = constructor;
         }
      } catch (e) {
         calleeType = PrimitiveType.Type;
         throw e;
      }
      // For future, check if calleeType is Type, only then go into Generic[Type] building
      if (options.isTypeLevel) {
         return new TypeOfTypes();
      }
      if (
         calleeType === PrimitiveType.Type ||
         calleeType instanceof SquareTypeToTypeLambdaType
      ) {
         const calleeAsType =
            calleeType instanceof SquareTypeToTypeLambdaType
               ? calleeType
               : scope.resolveNamedType(
                    this.context.translator.translate(node.callee, scope)
                 );
         if (calleeAsType instanceof SquareTypeToTypeLambdaType) {
            const constr = calleeAsType.buildConstructor();
            if (constr) {
               return constr;
            } else {
               return calleeAsType;
            }
         }
      } else if (calleeType instanceof SquareTypeToValueLambdaType) {
         const calledArgs = node.args.map(([n, t]) =>
            this.context.translator.translate(t, scope)
         );
         const expectedArgs = calleeType.paramTypes;
         const map = new GenericTypeMap();
         for (let i = 0; i < calledArgs.length; i++) {
            map.set(expectedArgs[i]?.name, calledArgs[i]);
         }
         return scope.resolveGenericTypes(calleeType.returnType, map);
      }

      throw new Error(
         `Not calling a function. Object ${
            node.callee.tag
         }(${node.callee.show()}) is of type ${calleeType.toString()} / ${
            calleeType.tag
         }`
      );
   }

   isCapitalized(str: string) {
      const parts = str.split("@");
      const lastPart = parts[parts.length - 1];

      return lastPart.charAt(0) === lastPart.charAt(0).toUpperCase();
   }

   asMutable(type: Type, node: Term, toMutable: boolean) {
      //   if (toMutable && !(type instanceof MutableType)) {
      //      node.invarTypeInVarPlace = true;
      //      return new MutableType(type);
      //   } else {
      return type;
      //   }
   }

   handleExtensionSearch(node: Call, scope: Scope) {
      // Handle extension method search
      if (node.callee instanceof Select) {
         try {
            const selectOwnerTypeBeforeResolve = this.infer(
               node.callee.owner,
               scope
            );
            const selectOwnerType = scope.resolveGenericTypes(
               selectOwnerTypeBeforeResolve,
               new GenericTypeMap() // ??
            );
            const symbol = scope.lookupExtension(
               node.callee.field,
               selectOwnerType
            );

            if (
               symbol.typeSymbol instanceof RoundValueToValueLambdaType &&
               symbol.typeSymbol.params[0]?.name === "self" &&
               selectOwnerType.isAssignableTo(
                  symbol.typeSymbol.params[0].type,
                  scope
               )
            ) {
               const owner = node.callee.owner;
               node.callee = new Identifier(symbol.name);
               node.bakedInThis = owner;
               this.context.builder.build(node.callee, scope);
               this.context.builder.build(node, scope);
            } else if (
               symbol.typeSymbol instanceof SquareTypeToValueLambdaType &&
               symbol.typeSymbol.returnType instanceof
                  RoundValueToValueLambdaType &&
               symbol.typeSymbol.returnType.params[0]?.name === "self"
            ) {
               const mappedParams = new GenericTypeMap();
               mappedParams.expectedTypes = symbol.typeSymbol.paramTypes;
               const ownerType = this.infer(node.callee.owner, scope);
               const expectedOwnerType =
                  symbol.typeSymbol.returnType.params[0].type;
               mappedParams.absorb(
                  this.context.builder.matchParamToGenericParam(
                     symbol.typeSymbol.paramTypes,
                     ownerType,
                     expectedOwnerType
                  )
               );
               if (
                  selectOwnerType instanceof AppliedGenericType &&
                  selectOwnerTypeBeforeResolve instanceof AppliedGenericType
               ) {
                  mappedParams.absorb(
                     this.context.builder.matchParamToGenericParam(
                        symbol.typeSymbol.paramTypes,
                        selectOwnerType.parameterTypes[0],
                        symbol.typeSymbol.returnType.params[0].type
                     )
                  );
               }
               //    }
               const resolvedOwnerType = scope.resolveGenericTypes(
                  selectOwnerType,
                  mappedParams
               );
               const resolvedExpectedType = scope.resolveGenericTypes(
                  symbol.typeSymbol.returnType.params[0].type,
                  mappedParams
               );
               if (
                  resolvedOwnerType.isAssignableTo(resolvedExpectedType, scope)
               ) {
                  const owner = node.callee.owner;
                  node.callee = new Identifier(symbol.name);
                  node.bakedInThis = owner;
                  node.id = ++Term.currentNumber;
                  node.callee.id = ++Term.currentNumber;
                  node.autoFilledSquareTypeParams = mappedParams;
                  walkTerms(node, scope, (node, scope) => {
                     node.id = ++Term.currentNumber;
                  });
                  this.context.builder.build(node, scope);
                  this.context.builder.build(node.callee, scope);
               }
            }
         } catch (e) {}
      } else if (
         node.callee instanceof Call &&
         node.callee.callee instanceof Select
      ) {
         try {
            // object.func[Obj, B](b)
            const selectOwnerType = scope.resolveGenericTypes(
               this.infer(node.callee.callee.owner, scope),
               new GenericTypeMap()
            );
            const symbol = scope.lookupExtension(
               node.callee.callee.field,
               selectOwnerType
            );
            if (
               symbol.typeSymbol instanceof SquareTypeToValueLambdaType &&
               symbol.typeSymbol.returnType instanceof
                  RoundValueToValueLambdaType &&
               symbol.typeSymbol.returnType.params[0]?.name === "self"
            ) {
               const mappedParams = new GenericTypeMap();
               mappedParams.absorb(
                  this.context.builder.matchParamToGenericParam(
                     symbol.typeSymbol.paramTypes,
                     selectOwnerType,
                     symbol.typeSymbol.returnType.params[0].type
                  )
               );
               if (
                  selectOwnerType.isAssignableTo(
                     scope.resolveGenericTypes(
                        symbol.typeSymbol.returnType.params[0].type,
                        mappedParams
                     ),
                     scope
                  )
               ) {
                  const owner = node.callee.callee.owner;
                  node.callee.callee = new Identifier(symbol.name);
                  node.bakedInThis = owner;
                  this.context.builder.build(node.callee, scope);
                  this.context.builder.build(node, scope);
                  this.context.builder.build(node.bakedInThis, scope);
               }
            }
         } catch (e) {}
      }
   }

   inferCurlyCall(
      node: Call,
      scope: Scope,
      options: RecursiveResolutionOptions
   ): Type {
      const calleeType = this.infer(node.callee, scope);
      const fields = this.getAllKnownFields(calleeType, scope);
      if (
         (fields.size === 0 && node.args.length > 0) ||
         (node.callee instanceof Identifier && node.callee.isTypeIdentifier())
      ) {
         return this.inferRoundApply(node, scope, options);
      } else {
         return calleeType;
      }
   }

   // func = [T, X] -> (thing: T, other: X) -> thing
   // func(12, "Something")
   // = Number
   inferRoundApply(
      node: Call,
      scope: Scope,
      options: RecursiveResolutionOptions
   ): Type {
      let calleeType;

      this.handleExtensionSearch(node, scope);

      if (!calleeType) {
         calleeType = scope.resolveNamedType(this.infer(node.callee, scope));
      }

      if (node.callee instanceof Identifier && node.callee.isTypeIdentifier()) {
         calleeType = scope.lookupType(node.callee.value).typeSymbol;
      }
      let constructor = calleeType.buildConstructor(scope, this.context);
      let isStructConstructor = false;
      if (node.kind === "CURLY") {
         if (constructor instanceof RoundValueToValueLambdaType) {
            calleeType = constructor;
            isStructConstructor = true;
            node.isCallingAConstructor = true;
         } else if (constructor instanceof SquareTypeToValueLambdaType) {
            calleeType = constructor;
            isStructConstructor = true;
            node.isCallingAConstructor = true;
         }
      }
      let usesVariableParameters = false;
      for (const arg of node.args) {
         // const argType = this.infer(arg[1], scope);
         const effects = this.context.checker.findEffects(
            arg[1],
            true,
            scope,
            scope
         );
         if (effects.length > 0) {
            usesVariableParameters = true;
         }
      }
      calleeType = scope.resolveNamedType(calleeType);
      if (calleeType instanceof OptionalType && node.ammortized) {
         calleeType = scope.resolveNamedType(calleeType.type);
      }

      if (calleeType instanceof RoundValueToValueLambdaType) {
         if (calleeType.returnType instanceof ThisType) {
            if (node.callee instanceof Select) {
               return this.infer(node.callee.owner, scope);
            } else if (!isStructConstructor) {
               this.context.logs.error({
                  message:
                     "Lambda returning 'this' was not called on an object.",
                  position: node.position,
               });
               return calleeType.returnType;
            }
         }
         let result = calleeType.returnType;
         if (node.ammortized && !(result instanceof OptionalType)) {
            result = new OptionalType(result);
         }
         return this.asMutable(result, node, usesVariableParameters);
      } else if (
         calleeType instanceof SquareTypeToValueLambdaType &&
         calleeType.returnType instanceof RoundValueToValueLambdaType
      ) {
         //  if (!node.getTypeArgs()) {
         this.context.builder.buildSquareArgsInRoundApply(
            node,
            calleeType,
            scope,
            node.getTypeArgs(),
            options
         );
         //  }
         const squareArgs = node.getTypeArgs();
         if (squareArgs) {
            const expectedArgs = calleeType.paramTypes;
            const result = scope.resolveGenericTypes(
               calleeType.returnType,
               squareArgs
            );
            if (result instanceof RoundValueToValueLambdaType) {
               let returnType = result.returnType;
               if (node.ammortized) {
                  returnType = new OptionalType(returnType);
               }
               return this.asMutable(returnType, node, usesVariableParameters);
            }
         }
         throw new Error(
            "Square lambda called with round parens, but types could not be automatically resolved."
         );
      }
      if (calleeType instanceof UncheckedType) {
         return calleeType;
      }
      // return Any;
      throw new Error(
         `Not calling a function. Object ${node.callee.show()} is of type ${calleeType.toString()} - ${
            node.position?.start.line
         } at ${scope.iteration}.` +
            (constructor !== undefined
               ? "You want to call constructors with {}"
               : "")
      );
   }

   // Questionable
   inferSelect(
      node: Select,
      scope: Scope,
      options: RecursiveResolutionOptions
   ): Type {
      function findField(
         fieldName: string,
         fields: Map<Type, ParamType[]>
      ): [Type, ParamType] | undefined {
         let firstFind: [Type, ParamType] | undefined;
         for (const [type, symbols] of fields) {
            for (const symbol of symbols) {
               if (symbol.name === fieldName) {
                  if (firstFind) {
                     if (
                        type instanceof StructType &&
                        firstFind[0] instanceof StructType
                     ) {
                        if (
                           type.nameAndAppliedSquareParams() !==
                           firstFind[0].nameAndAppliedSquareParams()
                        ) {
                           throw new Error(
                              "Attempted to access field " +
                                 node.field +
                                 ", but type has multiple fields of that name. Try casting the object first. Clash at " +
                                 type.nameAndAppliedSquareParams() +
                                 " and " +
                                 firstFind[0].nameAndAppliedSquareParams()
                           );
                        }
                     }
                  }
                  firstFind = [type, symbol];
               }
            }
         }
         return firstFind;
      }

      const asSelectOfIdentifiers = node.nameAsSelectOfIdentifiers();
      if (asSelectOfIdentifiers) {
         try {
            const type = scope.lookup(asSelectOfIdentifiers).typeSymbol;
            node.isDeclaration = true;
            return type;
         } catch (e) {
            // console.error(e.message);
            //
         }
      }

      let isOwnerMutable = false;
      let ownerType: Type;
      ownerType = this.infer(node.owner, scope);

      if (node.field === "Type") {
         return this.getTypeType(ownerType, scope);
      }
      // }
      if (node.ammortized && ownerType instanceof OptionalType) {
         ownerType = ownerType.type;
      } else if (
         node.ammortized &&
         ownerType instanceof MutableType &&
         ownerType.type instanceof OptionalType
      ) {
         ownerType = ownerType.type.type;
         isOwnerMutable = true;
      } else if (
         ownerType instanceof AppliedGenericType &&
         ownerType.resolved !== undefined
      ) {
         ownerType = ownerType.resolved;
      }
      if (ownerType instanceof NamedType) {
         ownerType = scope.lookupType(ownerType.name).typeSymbol;
      }
      if (ownerType instanceof IntersectionType) {
         ownerType = ownerType.simplified();
      }
      let fields: Map<Type, ParamType[]>;
      try {
         fields = this.getAllKnownFields(ownerType, scope);
      } catch (e) {
         console.log(node.field);
         throw e;
      }
      if (ownerType instanceof UnionType) {
         node.unionOwnerComponents = [...fields.keys()].map(
            (t) => t.name as string
         );
      }
      const found = findField(node.field, fields);
      if (!found) {
         //  this.context.errors.add(
         //     `Field '${node.field}' could not be found on '` +
         //        ownerType.toString() +
         //        "'",
         //     options.typeExpectedInPlace,
         //     undefined,
         //     node.position,
         //     "Found: " +
         //        [...fields.values()]
         //           .map((arr) => `${arr.map((p) => p.name)}`)
         //           .flat()
         //           .join(", ") +
         //        ""
         //  );
         if (scope.iteration === "RESOLUTION") {
            this.context.logs.error({
               message:
                  `Field '${node.field}' could not be found on '` +
                  ownerType.toString() +
                  "'",
               position: node.position,
            });
         }
         return new UncheckedType();
      }

      found[1].parentComponent = found[0];
      node.ownerComponent = found[0].name;
      if (found[0] instanceof StructType) {
         node.ownerComponentAppliedSquareTypes = (
            found[0].squareParamsApplied ?? []
         ).filter((t) => t !== undefined);
      }
      let result = found[1].type;
      //   if (isOwnerMutable && !(found[1].type instanceof MutableType)) {
      //      node.invarTypeInVarPlace = true;
      //   }
      if (node.ammortized) {
         result = new OptionalType(result);
      }
      return result;
   }

   findField(type: Type, field: string, scope: Scope): ParamType | undefined {
      function findField_(
         fieldName: string,
         fields: Map<Type, ParamType[]>
      ): [Type, ParamType] | undefined {
         let firstFind: [Type, ParamType] | undefined;
         for (const [type, symbols] of fields) {
            for (const symbol of symbols) {
               if (symbol.name === fieldName) {
                  if (firstFind) {
                     if (type.toString() !== firstFind[0].toString()) {
                        throw new Error(
                           "Attempted to access field " +
                              fieldName +
                              ", but type has multiple fields of that name. Try casting the object first. Clash at " +
                              type.toString() +
                              " and " +
                              firstFind[0].toString()
                        );
                     }
                  }
                  firstFind = [type, symbol];
               }
            }
         }
         return firstFind;
      }
      return findField_(field, this.getAllKnownFields(type, scope))?.[1];
   }

   getAllKnownFields(type: Type, scope: Scope): Map<Type, ParamType[]> {
      function mergeMaps<K, V>(
         map1: Map<K, V[]>,
         map2: Map<K, V[]>
      ): Map<K, V[]> {
         const mergedMap = new Map(map1);

         map2.forEach((value, key) => {
            const existing = mergedMap.get(key);
            mergedMap.set(key, existing ? [...existing, ...value] : [...value]);
         });

         return mergedMap;
      }

      if (type instanceof NamedType) {
         return this.getAllKnownFields(scope.resolveNamedType(type), scope);
      } else if (type instanceof StructType) {
         if (!type.name) {
            throw new Error("Found anonymous struct " + type.toString());
         }
         return new Map([[type, type.fields]]);
      } else if (type instanceof IntersectionType) {
         return mergeMaps(
            this.getAllKnownFields(type.left, scope),
            this.getAllKnownFields(type.right, scope)
         );
      } else if (type instanceof UnionType) {
         const commonType = this.deduceCommonType(type.left, type.right, scope);
         if (commonType instanceof UnionType) {
            return new Map([]);
         } else {
            return this.getAllKnownFields(commonType, scope);
         }
      } else if (type instanceof OptionalType) {
         return new Map();
      } else if (type instanceof AppliedGenericType) {
         return this.getAllKnownFields(
            scope.resolveAppliedGenericTypes(type),
            scope
         );
      } else if (type instanceof GenericNamedType) {
         if (type.extendedType) {
            return this.getAllKnownFields(type.extendedType, scope);
         }
         return new Map([]);
      } else if (type instanceof RoundValueToValueLambdaType) {
         return new Map([]);
      } else if (type instanceof AnyType) {
         return new Map([]);
      } else if (type instanceof MutableType) {
         return this.getAllKnownFields(type.type, scope);
      } else if (type instanceof RefinedType) {
         let result = this.getAllKnownFields(type.inputType, scope);
         if (type.lambda.block.statements.length === 1) {
            const trueSymbols: (Symbol | [Type, ParamType])[] = [];
            const falseSymbols: (Symbol | [Type, ParamType])[] = [];

            const innerScope = scope.innerScopeOf(type.lambda);
            this.context.builder.deduceCheckedTypes(
               type.lambda.block.statements[0],
               trueSymbols,
               falseSymbols,
               innerScope
            );
            for (const obj of result.entries()) {
               if (!(obj instanceof Symbol)) {
                  const singleType = obj[0];
                  obj[1] = [...obj[1]];
                  result.set(singleType, obj[1]);
                  const params = obj[1];
                  for (const param of params) {
                     for (const refined of trueSymbols) {
                        if (!(refined instanceof Symbol)) {
                           const singleTypeRefined = refined[0];
                           const refinedParam = refined[1];
                           if (
                              singleTypeRefined.isAssignableTo(
                                 singleType,
                                 innerScope
                              ) &&
                              param.name === refinedParam.name
                           ) {
                              const index = params.indexOf(param);
                              refinedParam.parentComponent =
                                 param.parentComponent;
                              refinedParam.mutable = param.mutable;
                              params[index] = refinedParam;
                           }
                        }
                     }
                  }
               }
            }
         }
         //  console.dir(result);
         return result;
      } else if (type instanceof PrimitiveType) {
         return new Map();
      } else {
         // throw new Error(
         //    "Could not deduce fields of type " +
         //       type.tag +
         //       " -" +
         //       type.toString()
         // );
      }
      return new Map();
   }

   findReturns(node: Statement, thisScope: Scope, acc: [Term, Type][]) {
      if (node instanceof AppliedKeyword && node.keyword === "return") {
         acc.push([node.param, this.infer(node.param, thisScope)]);
      } else if (node instanceof Optional) {
         node.expression.modifyFrom(node, IN_RETURN_BRANCH);
         const innerType = this.infer(node.expression, thisScope);
         if (innerType instanceof UnionType) {
            if (
               innerType.left.isAssignableTo(Nothing, thisScope) ||
               innerType.right.isAssignableTo(Nothing, thisScope)
            ) {
               acc.push([node, Nothing]);
            } else if (
               innerType.left.isAssignableTo(
                  new NamedType("Error"),
                  thisScope
               ) ||
               innerType.right.isAssignableTo(new NamedType("Error"), thisScope)
            ) {
               acc.push([node, new NamedType("Error")]);
            }
         }
         if (innerType instanceof OptionalType) {
            acc.push([node, Nothing]);
         }
      } else if (node instanceof Block) {
         const innerScope = thisScope.innerScopeOf(node, true);
         if (node.statements.length > 0) {
            const returnStatement = node.statements[node.statements.length - 1];
            returnStatement.modifyFrom(node, IN_RETURN_BRANCH);
            if (node.is(IN_RETURN_BRANCH)) {
               acc.push([
                  returnStatement,
                  this.infer(returnStatement, innerScope),
               ]);
            }
         }
         for (let statement of node.statements) {
            this.findReturns(statement, innerScope, acc);
         }
      } else if (node instanceof IfStatement) {
         const ifScope = thisScope.innerScopeOf(node, true);
         node.trueBranch.modifyFrom(node, IN_RETURN_BRANCH);
         node.falseBranch?.modifyFrom(node, IN_RETURN_BRANCH);
         this.findReturns(
            node.trueBranch,
            node.trueBranch instanceof Block
               ? ifScope.innerScopeOf(node.trueBranch, true)
               : ifScope,
            acc
         );
         if (node.falseBranch) {
            this.findReturns(
               node.falseBranch,
               node.falseBranch instanceof Block
                  ? ifScope.innerScopeOf(node.falseBranch, true)
                  : ifScope,
               acc
            );
         }
      } else if (node instanceof WhileLoop) {
         this.findReturns(node.action, thisScope.innerScopeOf(node), acc);
      } else if (node instanceof BinaryExpression) {
         this.findReturns(node.left, thisScope, acc);
         this.findReturns(node.right, thisScope, acc);
      } else if (node instanceof UnaryOperator) {
         this.findReturns(node.expression, thisScope, acc);
      } else if (node instanceof Select) {
         this.findReturns(node.owner, thisScope, acc);
      } else if (node instanceof Assignment && node.value !== undefined) {
         this.findReturns(node.value, thisScope, acc);
      } else if (node instanceof Call) {
         for (const arg of node.args) {
            this.findReturns(arg[1], thisScope, acc);
         }
      }
   }

   inferBlock(
      node: Block,
      scope: Scope,
      options: RecursiveResolutionOptions
   ): Type {
      // TO DO: change to find returns recursively
      const inferencer = this;

      if (node.statements.length === 0) {
         return new Type();
      }

      if (options.isTypeLevel) {
         return this.infer(node.statements[0], scope.innerScopeOf(node), {
            isTypeLevel: options.isTypeLevel,
         });
      }

      try {
         const allFoundReturnsInside: [Term, Type][] = [];
         node.modify(IN_RETURN_BRANCH);
         this.findReturns(node, scope, allFoundReturnsInside);
         const allFoundReturnTypesInside = allFoundReturnsInside.map((r) => {
            if (r[1] instanceof MutableType) {
               r[0].varTypeInInvarPlace = true;
               return r[1].type;
            } else {
               return r[1];
            }
         });
         for (const [term, type] of allFoundReturnsInside) {
            if (options.typeExpectedInPlace) {
               this.context.builder.buildVarTransformations(
                  term,
                  options.typeExpectedInPlace,
                  type
               );
            }
         }
         if (allFoundReturnsInside.length === 1) {
            const last = node.statements[node.statements.length - 1];
            if (
               (last instanceof Identifier && last.value === "self") ||
               (last instanceof AppliedKeyword &&
                  last.keyword === "return" &&
                  last.param instanceof Identifier &&
                  last.param.value === "self")
            ) {
               return new ThisType();
            }
            return allFoundReturnTypesInside[0];
         }
         let commonType: Type = allFoundReturnTypesInside[0] ?? Any;
         let i = 1;
         for (; i < allFoundReturnsInside.length; i++) {
            commonType = this.deduceCommonType(
               commonType,
               allFoundReturnTypesInside[i],
               scope
            );
         }
         return i === 0 ? Nothing : commonType;
      } catch (e) {
         if (scope.iteration === "DECLARATION") {
            return new UncheckedType();
         } else {
            throw e;
         }
      }
   }

   inferLiteral(
      node: Literal,
      scope: Scope,
      options: RecursiveResolutionOptions
   ) {
      let type: Type = Any;
      if (node.type === "Anything" && node.value === "") {
         return Any;
      }
      if (node.type === "Void") {
         return Nothing;
      }
      if (node.type === "String") {
         type = PrimitiveType.String;
      }
      if (node.type === "Number") {
         type = PrimitiveType.Number;
      }
      if (node.type === "Boolean") {
         type = PrimitiveType.Boolean;
      }
      if (options.expectsBroadenedType) {
         return type;
      }
      return new LiteralType(String(node.value), type);
   }

   getTypeType(type: Type, scope: Scope): Type {
      const types = this.getTypeTypeRaw(type, scope);

      return new IntersectionType(
         new NamedType("Type"),
         types,
         true
      ).simplified();
   }

   getTypeTypeRaw(type: Type, scope: Scope): Type {
      if (!scope.hasTypeSymbol("Struct")) {
         return new NamedType("Type");
      }
      if (type instanceof NamedType) {
         return this.getTypeType(scope.resolveNamedType(type), scope);
      } else if (type instanceof StructType) {
         return new NamedType("Struct");
      } else if (type instanceof UnionType) {
         return new NamedType("Union");
      } else if (type instanceof IntersectionType) {
         return new NamedType("Intersection");
      } else if (type instanceof RoundValueToValueLambdaType) {
         return new NamedType("Lambda");
      }
      if (type instanceof RefinedType) {
         return new NamedType("Refinement");
      }

      return new NamedType("Type");
   }

   inferIdentifier(
      node: Identifier,
      scope: Scope,
      options: RecursiveResolutionOptions
   ) {
      try {
         const symbol = scope.lookup(node.value); // ?? scope.lookupType(node.value);

         if (!symbol) {
            throw new Error(`Undefined identifier: ${node.value}`);
         }
         return symbol.typeSymbol;
      } catch (e) {
         if (node.isTypeIdentifier()) {
            if (options.isTypeLevel) {
               return new TypeOfTypes();
            }
            node.isInValueContext = true;
            const type = this.context.translator.translate(node, scope);
            return this.getTypeType(type, scope);
         }
         if (scope.iteration === "RESOLUTION") {
            this.context.logs.error({
               message:
                  `Value '${node.value}' is not defined - ` +
                  scope.toPath() +
                  " -- " +
                  scope.iteration,
               position: node.position,
            });
         }
         //  this.context.errors.;
         return new UncheckedType();
         // this.context.errors.add(
         //    `Could not find symbol '${node.value}'`,
         //    undefined,
         //    undefined,
         //    node.position
         // );
         // return {} as any;
      }
   }

   DEFINED_OPERATIONS = {
      NumberNumberNumber: ["+", "-", "*", "/", "**", "%"],
      NumberNumberBoolean: [">", "<", "<=", ">="],
      //   StringAnyString: ["+string+"],
      AnyAnyBoolean: ["==", "!="],
      BooleanBooleanBoolean: ["&&", "||"],
   };

   inferBinaryExpression(
      node: BinaryExpression,
      scope: Scope,
      options: RecursiveResolutionOptions
   ): Type {
      if (node.operator === "where") {
         return new TypeOfTypes();
      }

      if (options.isTypeLevel) {
         return new TypeOfTypes();
      }

      let leftType = this.infer(node.left, scope);
      let rightType = this.infer(node.right, scope);
      let hasVar = false;

      if (leftType instanceof MutableType) {
         leftType = leftType.type;
         // hasVar = true;
      }

      if (rightType instanceof MutableType) {
         rightType = rightType.type;
         // hasVar = true;
      }

      function make(type: Type) {
         if (hasVar) {
            return new MutableType(type);
         } else {
            return type;
         }
      }

      if (
         leftType.isAssignableTo(PrimitiveType.String, scope) &&
         node.operator === "+string+"
      ) {
         //  const entry = this.DEFINED_OPERATIONS.StringAnyString;
         //  if (entry.includes(node.operator)) {
         return make(PrimitiveType.String);
         //  }
      }
      if (node.operator === "?:") {
         const realLeftType =
            leftType instanceof OptionalType ? leftType.type : leftType;
         return this.deduceCommonType(leftType, rightType, scope);
      }

      if (this.DEFINED_OPERATIONS.AnyAnyBoolean.includes(node.operator)) {
         return make(PrimitiveType.Boolean);
      }

      if (
         leftType.isAssignableTo(PrimitiveType.Number, scope) &&
         rightType.isAssignableTo(PrimitiveType.Number, scope)
      ) {
         if (
            this.DEFINED_OPERATIONS.NumberNumberNumber.includes(node.operator)
         ) {
            return make(PrimitiveType.Number);
         }
         if (
            this.DEFINED_OPERATIONS.NumberNumberBoolean.includes(node.operator)
         ) {
            return make(PrimitiveType.Boolean);
         }
      }

      if (
         leftType.isAssignableTo(PrimitiveType.Boolean, scope) &&
         rightType.isAssignableTo(PrimitiveType.Boolean, scope)
      ) {
         if (
            this.DEFINED_OPERATIONS.BooleanBooleanBoolean.includes(
               node.operator
            )
         ) {
            return make(PrimitiveType.Boolean);
         }
      }

      if (node.operator === "&") {
         return new IntersectionType(leftType, rightType).simplified();
      }

      if (node.operator === "|") {
         if (leftType instanceof OptionalType) {
            return this.deduceCommonType(leftType.type, rightType, scope);
         }
         return new UnionType(leftType, rightType);
      }

      if (node.operator === "copy") {
         return leftType;
      }

      // Return a BinaryOpType if types are not directly inferrable
      this.context.logs.error({
         message:
            "Operation " +
            node.operator +
            ` not supported between ${leftType.toString()} and ${rightType.toString()}`,
         position: node.position,
      });
      return Any;
   }

   // (i: Number) -> i + 2
   inferRoundValueToValueLambda(
      node: RoundValueToValueLambda,
      scope: Scope,
      options: RecursiveResolutionOptions = {}
   ) {
      if (options.assignedName && this.isCapitalized(options.assignedName)) {
         return new TypeOfTypes();
      }
      const innerScope = scope.innerScopeOf(node, true);
      let paramsAsTypes: ParamType[] = [];
      const expected = options.typeExpectedInPlace;
      if (expected !== undefined) {
         if (expected instanceof RoundValueToValueLambdaType) {
            const inferredParams = node.params.map((param, i) => {
               return this.context.translator.translateRoundTypeToTypeLambdaParameter(
                  param,
                  scope,
                  { typeExpectedInPlace: expected.params[i].type }
               );
            });
            let i = 0;
            if (inferredParams.length !== expected.params.length) {
               this.context.logs.error({
                  message: `Expected parameter amount lambda parameter of call `,
                  position: node.position,
               });
            } else {
               for (let param of inferredParams) {
                  if (
                     !param.type.isAssignableTo(
                        expected.params[i].type,
                        innerScope
                     )
                  ) {
                     this.context.logs.error({
                        message: `Expected parameter ${
                           param.name || i
                        } of lambda parameter of call`,
                        expectedType: expected.params[i].type,
                        insertedType: param.type,
                        position: node.position,
                     });
                  }
                  i++;
               }
            }
            paramsAsTypes = expected.params;
         } else {
            throw new Error(
               "Expected lambda type, got " + expected + ", for " + node.tag
            );
         }
      } else {
         paramsAsTypes = node.params.map((param) => {
            return this.context.translator.translateRoundTypeToTypeLambdaParameter(
               param,
               scope,
               {}
            );
         });
      }

      if (
         node.isTypeLambda &&
         node instanceof RoundValueToValueLambda &&
         node.block instanceof Block &&
         node.block.statements[0]
      ) {
         const params = [];
         const returnType = this.context.translator.translate(
            node.block.statements[0],
            innerScope
         );
         const lambdaType = new RoundValueToValueLambdaType(
            paramsAsTypes,
            returnType,
            true,
            node.pure,
            node.capturesMutableValues
         );
         lambdaType.name = node.name;
         return lambdaType;
      } else {
         let specifiedType: Type | undefined;
         if (node.specifiedType) {
            specifiedType = this.context.translator.translate(
               node.specifiedType,
               innerScope
            );
         }
         if (specifiedType && scope.iteration === "DECLARATION") {
            return new RoundValueToValueLambdaType(
               paramsAsTypes,
               specifiedType,
               false,
               node.pure,
               node.capturesMutableValues
            );
         }
         let returnType = this.infer(node.block, innerScope, {
            isTypeLevel: options.isTypeLevel,
            typeExpectedInPlace: specifiedType,
         });

         if (specifiedType) {
            returnType = specifiedType;
            if (scope.iteration === "DECLARATION") {
               return returnType;
            }
         }
         const lambdaType = new RoundValueToValueLambdaType(
            paramsAsTypes,
            returnType,
            false,
            node.pure,
            node.capturesMutableValues
         );
         lambdaType.name = node.name;
         if (
            scope.iteration === "RESOLUTION" &&
            !(lambdaType instanceof MutableType)
         ) {
            this.context.builder.build(node, scope);
            // let effects = [
            //    ...this.context.checker.findEffects(
            //       node.block,
            //       true,
            //       innerScope,
            //       scope
            //    ),
            //    ...node.params.flatMap((p) =>
            //       this.context.checker.findEffects(p, true, innerScope, scope)
            //    ),
            // ];
            // if (effects.length > 0) {
            //    // lambdaType.capturesMutableValues = true;
            //    lambdaType.returnType = new MutableType(lambdaType.returnType);
            //    if (node.block instanceof Block) {
            //       this.inferBlock(node.block, innerScope, {
            //          typeExpectedInPlace: lambdaType.returnType,
            //       });
            //    }
            // }
         }

         return lambdaType;
      }
   }
}
