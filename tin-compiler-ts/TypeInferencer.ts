import {
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
   Block,
   Cast,
   DataDef,
   IfStatement,
   Make,
   Select,
   SquareTypeToValueLambda,
   Term,
   WhileLoop,
} from "./Parser";
import {
   Symbol,
   Scope,
   TypePhaseContext,
   RecursiveResolutionOptions,
} from "./Scope";
import { TypeErrorList } from "./TypeChecker";
import { ParamType, AnyTypeClass, UncheckedType, ThisType } from "./Types";
import { AstNode, Statement, AppliedKeyword } from "./Parser";
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
   AnyType,
   SquareTypeToValueLambdaType,
   TypeOfTypes,
   TypeRoundValueToValueLambda,
} from "./Types";

export class TypeInferencer {
   context: TypePhaseContext;
   constructor(context: TypePhaseContext) {
      this.context = context;
   }

   deduceCommonType(type1: Type, type2: Type, scope: Scope): Type {
      if (type1 === NamedType.PRIMITIVE_TYPES.Nothing) {
         return new OptionalType(type2);
      }
      if (type2 === NamedType.PRIMITIVE_TYPES.Nothing) {
         return new OptionalType(type1);
      }
      if (type1 instanceof AnyTypeClass) {
         return type2;
      }
      if (type2 instanceof AnyTypeClass) {
         return type1;
      }
      if (type1.isAssignableTo(type2, scope)) {
         return type2;
      }
      if (type2.isAssignableTo(type1, scope)) {
         return type1;
      }
      return new BinaryOpType(type1, "|", type2);
   }

   private buildCache = new Map<string, Type>();
   infer(
      node: AstNode,
      scope: Scope,
      options: RecursiveResolutionOptions = {}
   ) {
      const cachedString = `${node.id}.${scope.id}.${scope.iteration}`;
      const cachedType = this.buildCache.get(cachedString);
      if (cachedType) {
         return cachedType;
      }

      let inferredType: Type;
      switch (node.tag) {
         case "Literal":
            inferredType = this.inferLiteral(node as Literal, scope);
            break;
         case "Identifier":
            inferredType = this.inferIdentifier(node as Identifier, scope);
            break;
         case "Make":
            const type = scope.resolveNamedType(
               this.context.translator.translate((node as Make).type, scope)
            );
            if (!(type instanceof StructType)) {
               throw new Error("Was not struct type");
            }
            return new RoundValueToValueLambdaType(
               type.fields.map((f) => {
                  return new ParamType(f.type, f.name, f.defaultValue);
               }),
               type
            );
         case "Optional":
            inferredType = NamedType.PRIMITIVE_TYPES.Boolean;
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
            inferredType = this.inferBlock(node as Block, scope);
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
            inferredType = AnyType;
            break;
         case "DataDef":
            inferredType = this.inferData(node as DataDef, scope);
            break;
         case "Assignment":
            inferredType = NamedType.PRIMITIVE_TYPES.Nothing;
            break;
         case "TypeCheck":
            inferredType = NamedType.PRIMITIVE_TYPES.Boolean;
            break;
         case "Cast":
            inferredType = this.context.translator.translate(
               (node as Cast).type,
               scope
            );
            scope.resolveNamedType(inferredType);
            break;
         case "WhileLoop":
            inferredType = NamedType.PRIMITIVE_TYPES.Nothing;
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
         default:
            throw new Error(
               "Could not infer '" + node.tag + "' - " + node.position
            );
            inferredType = new Type(); // Unknown type by default
      }
      this.buildCache.set(cachedString, inferredType);
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
      let falseBranchType = NamedType.PRIMITIVE_TYPES.Nothing;
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
         this.infer(node.block, innerScope)
      );
   }

   inferSquareApply(node: SquareApply, scope: Scope): Type {
      // const calleeType = this.infer(node.callee, scope);
      let calleeType;
      try {
         calleeType = this.infer(node.callee, scope);
      } catch (e) {
         calleeType = NamedType.PRIMITIVE_TYPES.Type;
      }
      // For future, check if calleeType is Type, only then go into Generic[Type] building
      if (
         calleeType.toString() == "Type" ||
         calleeType instanceof SquareTypeToTypeLambdaType
      ) {
         const calleeAsType =
            calleeType instanceof SquareTypeToTypeLambdaType
               ? calleeType
               : scope.resolveNamedType(
                    this.context.translator.translate(node.callee, scope)
                 );
         if (calleeAsType instanceof SquareTypeToTypeLambdaType) {
            const actualParams = node.typeArgs.map((t) =>
               this.context.translator.translate(t, scope)
            );
            const expectedParams = calleeAsType.paramTypes;
            let params: { [_: string]: Type } = {};
            expectedParams.forEach((p, i) => {
               if (p.name) {
                  params[p.name] = actualParams[i];
               }
            });
            return scope.resolveGenericTypes(calleeAsType.returnType, params);
         }
      } else if (calleeType instanceof SquareTypeToValueLambdaType) {
         const calledArgs = node.typeArgs.map((t) =>
            this.context.translator.translate(t, scope)
         );
         const expectedArgs = calleeType.paramTypes;
         const params: { [_: string]: Type } = {};
         for (let i = 0; i < calledArgs.length; i++) {
            params[expectedArgs[i].name] = calledArgs[i];
         }
         return scope.resolveGenericTypes(calleeType.returnType, params);
      }

      throw new Error(
         `Not calling a function. Object ${
            node.callee.tag
         } is of type ${calleeType.toString()} / ${calleeType.tag}`
      );
   }

   isCapitalized(str: string) {
      return (
         str.charAt(0) === str.charAt(0).toUpperCase() &&
         !str.includes("@") &&
         !str.includes(".")
      );
   }

   // func = [T, X] -> (thing: T, other: X) -> thing
   // func(12, "Something")
   // = Number
   inferRoundApply(node: RoundApply, scope: Scope): Type {
      let calleeType = scope.resolveNamedType(this.infer(node.callee, scope));

      if (
         node.callee instanceof Identifier &&
         this.isCapitalized(node.callee.value)
      ) {
         const type = scope.resolveNamedType(
            this.context.translator.translate(node.callee, scope)
         );
         if (type instanceof StructType) {
            return type;
         } else if (type instanceof MarkerType) {
            return type;
         } else {
            throw new Error(
               "Cannot call constructor function for non struct-type. Was " +
                  type.toString()
            );
         }
      } else if (calleeType instanceof RoundValueToValueLambdaType) {
         if (calleeType.returnType instanceof ThisType) {
            if (node.callee instanceof Select) {
               return this.infer(node.callee.owner, scope);
            } else {
               this.context.errors.add(
                  "Lambda returning 'this' was not called on an object."
               );
               return calleeType.returnType;
            }
         }
         return calleeType.returnType;
      } else if (
         calleeType instanceof SquareTypeToValueLambdaType &&
         calleeType.returnType instanceof RoundValueToValueLambdaType
      ) {
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
               return result.returnType;
            }
         }
         throw new Error(
            "Square lambda called with round parens, but types could not be automatically resolved."
         );
      }
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
                     throw new Error(
                        "Attempted to access field " +
                           node.field +
                           ", but type has multiple fields of that name. Try casting the object first."
                     );
                  }
                  firstFind = [type, symbol];
               }
            }
         }
         return firstFind;
      }

      let ownerType = this.infer(node.owner, scope);
      if (node.ammortized && ownerType instanceof OptionalType) {
         ownerType = ownerType.type;
      }
      if (
         ownerType instanceof AppliedGenericType &&
         ownerType.resolved !== undefined
      ) {
         ownerType = ownerType.resolved;
      }
      if (ownerType instanceof NamedType) {
         ownerType = scope.lookupType(ownerType.name).typeSymbol;
      }
      const fields = this.getAllKnownFields(ownerType, scope);
      const found = findField(node.field, fields);
      if (!found) {
         throw new Error(
            `Field '${node.field}' could not be found on '` +
               ownerType.toString() +
               "'"
         );
      }

      found[1].parentComponent = found[0];
      node.ownerComponent = found[0].name;
      let result = found[1].type;
      if (node.ammortized) {
         result = new OptionalType(result);
      }
      return result;
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
         if (type.isPrimitive()) {
            return new Map([]);
         }
         return this.getAllKnownFields(scope.resolveNamedType(type), scope);
      } else if (type instanceof StructType) {
         if (!type.name) {
            throw new Error("Found anonymous struct " + type.toString());
         }
         return new Map([[type, type.fields]]);
      } else if (type instanceof BinaryOpType && type.operator == "&") {
         return mergeMaps(
            this.getAllKnownFields(type.left, scope),
            this.getAllKnownFields(type.right, scope)
         );
      } else if (type instanceof BinaryOpType && type.operator == "|") {
         const leftFields = this.getAllKnownFields(type.left, scope);
         const rightFields = this.getAllKnownFields(type.right, scope);
         const commonFields = [] as ParamType[];
         // for (const [type, leftFieldsOfType] of leftFields) {
         //    for (const leftField of leftFieldsOfType) {
         //       const rightField = [...rightFields.values()]
         //          .flat()
         //          .find((f) => f.name === leftField.name);
         //       if (rightField === undefined) continue;
         //       const leftType = scope.resolveNamedType(leftField.typeSymbol);
         //       const rightType = scope.resolveNamedType(rightField.typeSymbol);
         //       if (rightType.isAssignableTo(leftType, scope)) {
         //          commonFields.push(leftField);
         //       } else if (leftType.isAssignableTo(rightType, scope)) {
         //          commonFields.push(rightField);
         //       }
         //    }
         // }
         return new Map();
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
         return new Map([]);
      } else if (type instanceof RoundValueToValueLambdaType) {
         return new Map([]);
      } else if (type instanceof AnyTypeClass) {
         return new Map([]);
      } else {
         throw new Error(
            "Could not deduce fields of type " +
               type.tag +
               " -" +
               type.toString()
         );
      }
      return new Map();
   }

   inferBlock(node: Block, scope: Scope) {
      // TO DO: change to find returns recursively
      const inferencer = this;
      function findReturns(node: Statement, thisScope: Scope, acc: Type[]) {
         if (node instanceof AppliedKeyword && node.keyword === "return") {
            acc.push(inferencer.infer(node.param, thisScope));
         } else if (node instanceof Block) {
            const innerScope = thisScope.innerScopeOf(node, true);
            for (let statement of node.statements) {
               findReturns(statement, innerScope, acc);
            }
            if (node.statements.length > 0) {
               acc.push(
                  inferencer.infer(
                     node.statements[node.statements.length - 1],
                     innerScope
                  )
               );
            }
         } else if (node instanceof IfStatement) {
            const ifScope = thisScope.innerScopeOf(node, true);
            findReturns(
               node.trueBranch,
               node.trueBranch instanceof Block
                  ? ifScope.innerScopeOf(node.trueBranch, true)
                  : ifScope,
               acc
            );
            if (node.falseBranch) {
               findReturns(
                  node.falseBranch,
                  node.falseBranch instanceof Block
                     ? ifScope.innerScopeOf(node.falseBranch, true)
                     : ifScope,
                  acc
               );
            }
         } else if (node instanceof WhileLoop && node.eachLoop) {
            findReturns(node.eachLoop, thisScope.innerScopeOf(node), acc);
         } else if (node instanceof BinaryExpression) {
            findReturns(node.left, thisScope, acc);
            findReturns(node.right, thisScope, acc);
         } else if (node instanceof UnaryOperator) {
            findReturns(node.expression, thisScope, acc);
         }
      }

      if (node.statements.length === 0) {
         return new Type();
      }

      try {
         const allFoundReturnsInside: Type[] = [];
         findReturns(node, scope, allFoundReturnsInside);
         if (allFoundReturnsInside.length === 1) {
            const last = node.statements[node.statements.length - 1];
            if (
               (last instanceof Identifier && last.value === "this") ||
               (last instanceof AppliedKeyword &&
                  last.keyword === "return" &&
                  last.param instanceof Identifier &&
                  last.param.value === "this")
            ) {
               return new ThisType();
            }
            return allFoundReturnsInside[0];
         }
         let commonType: Type = AnyType;
         for (let i = 0; i < allFoundReturnsInside.length; i++) {
            commonType = this.deduceCommonType(
               commonType,
               allFoundReturnsInside[i],
               scope
            );
         }
         return commonType;
      } catch (e) {
         if (scope.iteration === "DECLARATION") {
            return new UncheckedType();
         } else {
            throw e;
         }
      }
   }

   inferLiteral(node: Literal, scope: Scope) {
      // Handle different literal types (assuming 'Number' is one type)
      if (node.type === "Any" && node.value === "") {
         return AnyType;
      }
      if (node.type === "Void") {
         return NamedType.PRIMITIVE_TYPES.Nothing;
      }
      return new LiteralType(
         String(node.value),
         scope.lookupType(node.type).typeSymbol
      );
   }

   inferIdentifier(node: Identifier, scope: Scope) {
      try {
         const symbol = scope.lookup(node.value); // ?? scope.lookupType(node.value);

         if (!symbol) {
            if (
               node.value.charAt(0) === node.value.charAt(0).toUpperCase() &&
               !node.value.includes("@") &&
               !node.value.includes(".")
            ) {
               return NamedType.PRIMITIVE_TYPES.Type;
            }
            throw new Error(`Undefined identifier: ${node.value}`);
         }
         return symbol.typeSymbol;
      } catch (e) {
         throw new Error(
            `Could not find symbol '${node.value}' - ` +
               scope.toPath() +
               " -- " +
               scope.iteration
         );
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
      NumberNumberNumber: ["+", "-", "*", "/", "**"],
      NumberNumberBoolean: [">", "<", "<=", ">=", "=="],
      StringAnyString: ["+"],
   };

   inferBinaryExpression(node: BinaryExpression, scope: Scope): Type {
      const leftType = this.infer(node.left, scope);
      const rightType = this.infer(node.right, scope);
      // Here, you would define the logic to determine the resulting type based on the operator
      // For example, if the operator is '+', you might expect both operands to be of type 'Int'
      const Number = scope.lookupType("Number");
      const String = scope.lookupType("String");
      const Boolean = scope.lookupType("Boolean");
      if (leftType.isAssignableTo(String.typeSymbol, scope)) {
         const entry = this.DEFINED_OPERATIONS.StringAnyString;
         if (entry.includes(node.operator)) {
            return String.typeSymbol;
         }
      }
      if (node.operator === "?:") {
         const realLeftType =
            leftType instanceof OptionalType ? leftType.type : leftType;
         return this.deduceCommonType(leftType, rightType, scope);
      }
      if (
         (leftType.isAssignableTo(Number.typeSymbol, scope) &&
            rightType.isAssignableTo(Number.typeSymbol, scope),
         scope)
      ) {
         const entry = this.DEFINED_OPERATIONS.NumberNumberNumber;
         if (entry.includes(node.operator)) {
            return Number.typeSymbol;
         }
      }
      if (
         leftType.isAssignableTo(Number.typeSymbol, scope) &&
         rightType.isAssignableTo(Number.typeSymbol, scope)
      ) {
         const entry = this.DEFINED_OPERATIONS.NumberNumberBoolean;
         if (entry.includes(node.operator)) {
            return Boolean.typeSymbol;
         }
      }

      if (node.operator === "&") {
         return new BinaryOpType(leftType, "&", rightType).simplified();
      }

      if (node.operator === "|") {
         return new BinaryOpType(leftType, "|", rightType);
      }

      // Return a BinaryOpType if types are not directly inferrable
      return new BinaryOpType(leftType, node.operator, rightType);
   }

   inferRoundTypeToTypeLambda(node: RoundTypeToTypeLambda, scope: Scope) {
      const paramScope = scope.innerScopeOf(node);
      node.parameterTypes.forEach((p) => {
         if (p instanceof Assignment && p.lhs instanceof Identifier) {
            paramScope.declareType(
               new Symbol(
                  p.lhs.value,
                  new GenericNamedType(
                     p.lhs.value,
                     p.value ? this.infer(p.value, scope) : undefined
                  )
               )
            );
         }
      });
      const type = new TypeRoundValueToValueLambda(
         node.parameterTypes.map((p) => {
            if (p instanceof Assignment && p.lhs instanceof Identifier) {
               return this.context.translator.translate(p.lhs, paramScope);
            } else {
               throw new Error("Params weren't assignment types");
            }
         }),
         this.infer(node.returnType, paramScope)
      );
      return type;
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
      // Check for Varargs expected type
      if (
         node.params[0] &&
         node.params[0] instanceof Assignment &&
         node.params[0].type &&
         node.params[0].type instanceof UnaryOperator &&
         node.params[0].type.operator === "..."
      ) {
         const param = node.params[0];
         const paramType = new AppliedGenericType(
            innerScope.lookupType("Array").typeSymbol,
            [
               this.context.translator.translate(
                  node.params[0].type.expression,
                  innerScope
               ),
            ]
         );
         // paramType.resolved = innerScope.lookup("Array").returnType;
         paramsAsTypes = [new ParamType(paramType)];
         if (param instanceof Assignment && param.lhs instanceof Identifier) {
            if (!innerScope.hasSymbol(param.lhs.value)) {
               innerScope.declare(
                  new Symbol(param.lhs.value, paramType, param)
               );
            }
         }
      } else {
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
      }

      if (
         node.isTypeLambda &&
         node instanceof RoundValueToValueLambda &&
         node.block instanceof Block &&
         node.block.statements[0]
      ) {
         const params = [];
         // node.params.forEach((p) => {
         //    if (p instanceof Assignment && p.lhs instanceof Identifier) {
         //       innerScope.declareType(
         //          new Symbol(p.lhs.value, new NamedType(p.lhs.value))
         //       );
         //    }
         // });
         const returnType = this.context.translator.translate(
            node.block.statements[0],
            innerScope
         );
         const lambdaType = new RoundValueToValueLambdaType(
            paramsAsTypes,
            returnType,
            true
         );
         return lambdaType;
      } else {
         const returnType = this.infer(node.block, innerScope);
         if (node.explicitType) {
            const explicitType = this.context.translator.translate(
               node.explicitType,
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
         const lambdaType = new RoundValueToValueLambdaType(
            paramsAsTypes,
            returnType
         );
         return lambdaType;
      }
   }
}
