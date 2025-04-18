import {
   Nothing,
   RefinedType,
   NamedType,
   PrimitiveType,
   IntersectionType,
} from "./Types";
import { IN_RETURN_BRANCH, Optional, Tuple } from "./Parser";
import { UnionType } from "./Types";
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
   RoundApply,
   RoundValueToValueLambda,
   Select,
   SquareApply,
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
   infer(node: Term, scope: Scope, options: RecursiveResolutionOptions = {}) {
      const cachedString = `${node.id}.${scope.id}.${scope.iteration}`;
      const cachedType = this.buildCache.get(cachedString);
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
               scope
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
         case "RoundApply":
            inferredType = this.inferRoundApply(node as RoundApply, scope);
            break;
         case "SquareApply":
            inferredType = this.inferSquareApply(node as SquareApply, scope);
            break;
         case "Select":
            inferredType = this.inferSelect(node as Select, scope);
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
      const innerScope = scope.innerScopeOf(node);
      const trueBranchType = this.infer(
         node.trueBranch,
         innerScope.innerScopeOf(node.trueBranch, true)
      );
      let falseBranchType: Type = Nothing;
      if (node.falseBranch !== undefined) {
         falseBranchType = this.infer(node.falseBranch, innerScope);
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

   inferSquareApply(node: SquareApply, scope: Scope): Type {
      let calleeType;
      //   this.handleSquareExtensionSearch(node, scope);
      try {
         calleeType =
            node.callee instanceof Identifier && node.callee.isTypeIdentifier()
               ? this.context.translator.translate(node.callee, scope)
               : this.infer(node.callee, scope);
         const constructor = scope
            .resolveNamedType(calleeType)
            .buildConstructor();
         if (constructor instanceof SquareTypeToValueLambdaType) {
            calleeType = constructor;
         }
      } catch (e) {
         calleeType = PrimitiveType.Type;
         throw e;
      }
      // For future, check if calleeType is Type, only then go into Generic[Type] building
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
               throw new Error("What");
            }
         }
      } else if (calleeType instanceof SquareTypeToValueLambdaType) {
         const calledArgs = node.typeArgs.map((t) =>
            this.context.translator.translate(t, scope)
         );
         const expectedArgs = calleeType.paramTypes;
         const params: { [_: string]: Type } = {};
         for (let i = 0; i < calledArgs.length; i++) {
            params[expectedArgs[i]?.name] = calledArgs[i];
         }
         return scope.resolveGenericTypes(calleeType.returnType, params);
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

   handleExtensionSearch(node: RoundApply, scope: Scope) {
      //   console.log("Trying to find for ");
      //   console.log(node);
      // Handle extension method search
      if (node.callee instanceof Select) {
         try {
            const selectOwnerType = scope.resolveGenericTypes(
               this.infer(node.callee.owner, scope)
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
               const mappedParams: Map<GenericNamedType, Type> = new Map();
               for (
                  let i = 0;
                  i < symbol.typeSymbol.returnType.params.length;
                  i++
               ) {
                  this.context.builder.matchParamToGenericParam(
                     symbol.typeSymbol.paramTypes,
                     selectOwnerType,
                     symbol.typeSymbol.returnType.params[i].type,
                     mappedParams
                  );
               }
               const params: { [_: string]: Type } = {};
               for (let [k, v] of mappedParams.entries()) {
                  params[k.name] = v;
               }
               if (
                  selectOwnerType.isAssignableTo(
                     scope.resolveGenericTypes(
                        symbol.typeSymbol.returnType.params[0].type,
                        params
                     ),
                     scope
                  )
               ) {
                  const owner = node.callee.owner;
                  node.callee = new Identifier(symbol.name);
                  node.bakedInThis = owner;
                  node.id = ++Term.currentNumber;
                  node.callee.id = ++Term.currentNumber;
                  this.context.builder.build(node.callee, scope);
                  this.context.builder.build(node, scope);
               }
            }
         } catch (e) {}
      } else if (
         node.callee instanceof SquareApply &&
         node.callee.callee instanceof Select
      ) {
         // object.func[Obj, B](b)
         const selectOwnerType = scope.resolveGenericTypes(
            this.infer(node.callee.callee.owner, scope)
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
            const mappedParams: Map<GenericNamedType, Type> = new Map();
            this.context.builder.matchParamToGenericParam(
               symbol.typeSymbol.paramTypes,
               selectOwnerType,
               symbol.typeSymbol.returnType.params[0].type,
               mappedParams
            );
            const params: { [_: string]: Type } = {};
            for (let [k, v] of mappedParams.entries()) {
               params[k.name] = v;
            }
            if (
               selectOwnerType.isAssignableTo(
                  scope.resolveGenericTypes(
                     symbol.typeSymbol.returnType.params[0].type,
                     params
                  ),
                  scope
               )
            ) {
               const owner = node.callee.callee.owner;
               node.callee.callee = new Identifier(symbol.name);
               node.bakedInThis = owner;
               this.context.builder.build(node.callee, scope);
               this.context.builder.build(node, scope);
            }
         }
      }
   }

   // func = [T, X] -> (thing: T, other: X) -> thing
   // func(12, "Something")
   // = Number
   inferRoundApply(node: RoundApply, scope: Scope): Type {
      let calleeType;

      this.handleExtensionSearch(node, scope);

      if (!calleeType) {
         calleeType = scope.resolveNamedType(this.infer(node.callee, scope));
      }

      if (node.callee instanceof Identifier && node.callee.isTypeIdentifier()) {
         calleeType = scope.lookupType(node.callee.value).typeSymbol;
      }
      let constructor = calleeType.buildConstructor();
      let isStructConstructor = false;
      if (constructor instanceof RoundValueToValueLambdaType) {
         calleeType = constructor;
         isStructConstructor = true;
         node.isCallingAConstructor = true;
      } else if (constructor instanceof SquareTypeToValueLambdaType) {
         calleeType = constructor;
         isStructConstructor = true;
         node.isCallingAConstructor = true;
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
      if (calleeType instanceof RoundValueToValueLambdaType) {
         if (calleeType.returnType instanceof ThisType) {
            if (node.callee instanceof Select) {
               return this.infer(node.callee.owner, scope);
            } else if (!isStructConstructor) {
               this.context.errors.add(
                  "Lambda returning 'this' was not called on an object."
               );
               return calleeType.returnType;
            }
         }
         return this.asMutable(
            calleeType.returnType,
            node,
            usesVariableParameters
         );
      } else if (
         calleeType instanceof SquareTypeToValueLambdaType &&
         calleeType.returnType instanceof RoundValueToValueLambdaType
      ) {
         this.context.builder.buildSquareArgsInRoundApply(
            node,
            calleeType,
            scope
         );
         const squareArgs = node.autoFilledSquareParams;

         const calledArgs = squareArgs;
         if (calledArgs) {
            const expectedArgs = calleeType.paramTypes;
            const params: { [_: string]: Type } = {};
            for (let i = 0; i < calledArgs.length; i++) {
               params[expectedArgs[i].name] = calledArgs[i];
            }
            const result = scope.resolveGenericTypes(
               calleeType.returnType,
               params
            );
            if (result instanceof RoundValueToValueLambdaType) {
               return this.asMutable(
                  result.returnType,
                  node,
                  usesVariableParameters
               );
            }
         }
         throw new Error(
            "Square lambda called with round parens, but types could not be automatically resolved."
         );
      }
      // return Any;
      throw new Error(
         `Not calling a function. Object ${
            node.callee.tag
         } is of type ${calleeType.toString()} - ${node.position?.start.line}`
      );
   }

   // Questionable
   inferSelect(node: Select, scope: Scope): Type {
      function findField(
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
                              node.field +
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

      const asSelectOfIdentifiers = node.nameAsSelectOfIdentifiers();
      if (asSelectOfIdentifiers) {
         try {
            const type = scope.lookup(asSelectOfIdentifiers).typeSymbol;
            node.isDeclaration = true;
            return type;
         } catch (e) {
            //
         }
      }

      let isOwnerMutable = false;
      let ownerType: Type;
      ownerType = this.infer(node.owner, scope);
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
         throw new Error(
            `Field '${node.field}' could not be found on '` +
               ownerType.toString() +
               "', fields found: [" +
               [...fields.values()].flat() +
               "]"
         );
      }

      found[1].parentComponent = found[0];
      node.ownerComponent = found[0].name;
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
      function findField(
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
      return findField(field, this.getAllKnownFields(type, scope))?.[1];
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
         // const originalFields = this.getAllKnownFields(type.type, scope);
         // return originalFields.map((f) => {
         //    return new Symbol(
         //       f.name,
         //       f.typeSymbol instanceof OptionalType
         //          ? f.typeSymbol
         //          : new OptionalType(f.typeSymbol)
         //    );
         // });
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
         return this.getAllKnownFields(type.inputType, scope);
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
      } else if (node instanceof RoundApply) {
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

      try {
         const allFoundReturnsInside: [Term, Type][] = [];
         node.modify(IN_RETURN_BRANCH);
         this.findReturns(node, scope, allFoundReturnsInside);
         const allFoundReturnTypesInside = allFoundReturnsInside.map(
            (r) => r[1]
         );
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

   getTypeType(type: Type, scope: Scope): NamedType {
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
            this.context.errors.add(
               `Value '${node.value}' is not defined - ` +
                  scope.toPath() +
                  " -- " +
                  scope.iteration,
               undefined,
               undefined,
               node.position
            );
         }
         return Any;
         // this.context.errors.add(
         //    `Could not find symbol '${node.value}'`,
         //    undefined,
         //    undefined,
         //    node.position
         // );
         // this.context.errors.throwAll();
         // return {} as any;
      }
   }

   DEFINED_OPERATIONS = {
      NumberNumberNumber: ["+", "-", "*", "/", "**", "%"],
      NumberNumberBoolean: [">", "<", "<=", ">="],
      StringAnyString: ["+"],
      AnyAnyBoolean: ["==", "!="],
      BooleanBooleanBoolean: ["&&", "||"],
   };

   inferBinaryExpression(node: BinaryExpression, scope: Scope): Type {
      if (node.operator === "where") {
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

      if (leftType.isAssignableTo(PrimitiveType.String, scope)) {
         const entry = this.DEFINED_OPERATIONS.StringAnyString;
         if (entry.includes(node.operator)) {
            return make(PrimitiveType.String);
         }
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
         (leftType.isAssignableTo(PrimitiveType.Number, scope) &&
            rightType.isAssignableTo(PrimitiveType.Number, scope),
         scope)
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
      this.context.errors.add(
         "Operation " +
            node.operator +
            ` not supported between ${leftType.toString()} and ${rightType.toString()}`,
         undefined,
         undefined,
         node.position
      );
      return Any;
   }

   // inferRoundTypeToTypeLambda(node: RoundTypeToTypeLambda, scope: Scope) {
   //    const paramScope = scope.innerScopeOf(node);
   //    node.parameterTypes.forEach((p) => {
   //       if (p instanceof Assignment && p.lhs instanceof Identifier) {
   //          paramScope.declareType(
   //             new Symbol(
   //                p.lhs.value,
   //                new GenericNamedType(
   //                   p.lhs.value,
   //                   p.value ? this.infer(p.value, scope) : undefined
   //                )
   //             )
   //          );
   //       }
   //    });
   //    const type = new TypeRoundValueToValueLambda(
   //       node.parameterTypes.map((p) => {
   //          if (p instanceof Assignment && p.lhs instanceof Identifier) {
   //             return this.context.translator.translate(p.lhs, paramScope);
   //          } else {
   //             throw new Error("Params weren't assignment types");
   //          }
   //       }),
   //       this.infer(node.returnType, paramScope)
   //    );
   //    return type;
   // }

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
               this.context.errors.add(
                  `Expected parameter amount lambda parameter of call `,
                  undefined,
                  undefined,
                  node.position
               );
            } else {
               for (let param of inferredParams) {
                  if (
                     !param.type.isAssignableTo(
                        expected.params[i].type,
                        innerScope
                     )
                  ) {
                     this.context.errors.add(
                        `Expected parameter ${
                           param.name || i
                        } of lambda parameter of call`,
                        expected.params[i].type,
                        param.type
                     );
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
         let returnType = this.infer(node.block, innerScope, {
            typeExpectedInPlace: specifiedType,
         });

         if (specifiedType) {
            returnType = specifiedType;
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
            let effects = [
               ...this.context.checker.findEffects(
                  node.block,
                  true,
                  innerScope,
                  scope
               ),
               ...node.params.flatMap((p) =>
                  this.context.checker.findEffects(p, true, innerScope, scope)
               ),
            ];
            if (effects.length > 0) {
               // lambdaType.capturesMutableValues = true;
               lambdaType.returnType = new MutableType(lambdaType.returnType);
               if (node.block instanceof Block) {
                  this.inferBlock(node.block, innerScope, {
                     typeExpectedInPlace: lambdaType.returnType,
                  });
               }
            }
         }

         return lambdaType;
      }
   }
}
