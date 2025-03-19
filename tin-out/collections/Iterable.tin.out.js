const __tin_varargs_marker = Symbol();

function TIN_TYPE(typeId, typeHash, constructorRaw, descriptor) {
	const symbol = Symbol();
	const constructor = (...args) => {
		const result = constructorRaw(...args)
		return {
			[symbol]: result
		};
	}
	constructor._symbol = symbol;
	globalThis[symbol] = constructor;
	constructor.descriptor = descriptor;
	constructor._typeId = typeId;
	constructor.toString = () => {
		return descriptor.toString()
	}
	constructor.__is_child = (obj) => {
		return (typeof obj === "object") && Reflect.ownKeys(obj).includes(typeId)
	}

	return constructor;
}

function TIN_LAMBDA(typeId, lambda, type) {
	lambda.type = type;
	lambda.typeId = typeId;
	return lambda;
}

// function _TIN_MAKE_LAMBDA(type)

const _TIN_INTERSECT_OBJECTS = function (obj1, obj2) {
	if (obj1 === undefined) {
		return obj2
	}
	if (obj2 === undefined) {
		return obj1
	}
	const commonModules = [];
	for (let key of Reflect.ownKeys(obj1)) {
		if (Reflect.ownKeys(obj2).includes(key)) {
			commonModules.push(key)
		}
	}
	const newObj = { ...obj1 };
	const obj1Keys = Reflect.ownKeys(obj1)
	const obj2Keys = Reflect.ownKeys(obj2)
	for (let key of obj2Keys) {
		if (obj1Keys.includes(key)) {
			const obj2Module = obj2[key]
			for (let originalKey of Reflect.ownKeys(obj2Module)) {
				if (obj2Module[originalKey] !== undefined) {
					newObj[key][originalKey] = obj2Module[originalKey]
				}
			}
		} else {
			newObj[key] = obj2[key]
		}
	}
	return newObj
}

const _TIN_UNION_OBJECTS = function (obj1, obj2) {
	return [obj1, obj2]
}

const nothing = undefined;

const Type = TIN_TYPE("", "", (i) => null, {})
const Int = TIN_TYPE("", "", (i) => Number(i), {})
const String = TIN_TYPE("", "", (i) => String(i), {})
const Void = TIN_TYPE("", "", (i) => null, {})
const Array = (T) => TIN_TYPE("Array", "", (args) => args[__tin_varargs_marker] ? args : ({
	_rawArray: args,
	length() {
		return args.length;
	},
	at(index) {
		return args[index]
	},
	[__tin_varargs_marker]: true,
	toString() {
		const parts = args.map(x => JSON.stringify(x)).join(", ")
		return "Array(" + parts + ")"
	}
}), {})

const Array$of = (t) => (args) => args
Array._typeId = "Array"

const copy = (T) => (obj) => {
	const newObj = {};
	for (let key of Reflect.ownKeys(obj)) {
		newObj[key] = { ...obj[key] }
	}
	return newObj;
}

function getRandomInt(min, max) {
	const minCeiled = Math.ceil(min);
	const maxFloored = Math.floor(max);
	return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
}

function makeString(obj) {
	if (obj === null) return 'nothing';
	if (typeof obj === 'undefined') return 'nothing';
	if (typeof obj === 'boolean') return obj ? 'true' : 'false';
	if (typeof obj === 'number') return obj.toString();
	if (typeof obj === 'string') return obj;

	if (typeof obj === 'function') {
		return 'λ'
	}

	if (Reflect.ownKeys(obj).includes("Array")) {
		let result = 'Array(';
		for (let i = 0; i < obj.Array.length(); i++) {
			result += makeString(obj.Array.at(i)) + (i === obj.Array.length() - 1 ? "" : ", ")
		}
		return result + ")"
	}

	if (typeof obj === 'object') {
		let result = '(';
		let number = 0;
		for (let componentKey of Reflect.ownKeys(obj)) {
			const component = obj[componentKey]
			for (let key in component) {
				if (component.hasOwnProperty(key)) {
					if (key.startsWith("__")) {
						continue
					}
					result += globalThis[componentKey]._typeId + "." + key + "=" + makeString(component[key]) + ', ';
				}
			}
			if (result.length > 1 && result[result.length - 2] === ",") {
				result = result.slice(0, -2); // Remove trailing comma and space
			}
			result += ", "
		}
		if (result.length > 1 && result[result.length - 2] === ",") {
			result = result.slice(0, -2); // Remove trailing comma and space
		}
		return result + ')';
	}

	return ''; // For other types like functions, symbols, etc.
}

const print = (arg) => {
	console.log(makeString(arg))
}

const debug = (...args) => {
	console.log(...args)
}

// COMPILED TIN
;
export var Iterator = /* [] */(T) => TIN_TYPE("Iterator", "e38913d6-12b2-4105-ab33-19b0705b4f5e", (_p0) => ({next: _p0}), {
		Type: {
			tag: "Struct",
			name: "Iterator",
				fields: [
					{
			Field: {
				name: "next",
				type: {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [],
			returnType: ???
		}
	},
				defaultValue: () => { return (undefined);},
			}
		},
		]
		}
	}); Iterator._typeId = "Iterator";;
export var Accessible = /* [] */(T) => TIN_TYPE("Accessible", "6e2d4466-3bea-4fa8-9a24-86bda61d2369", (_p0,_p1) => ({at: _p0,length: _p1}), {
		Type: {
			tag: "Struct",
			name: "Accessible",
				fields: [
					{
			Field: {
				name: "at",
				type: {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "index",
				type: () => Number,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: () => T
		}
	},
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "length",
				type: {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [],
			returnType: () => Number
		}
	},
				defaultValue: () => { return (undefined);},
			}
		},
		]
		}
	}); Accessible._typeId = "Accessible";;
;
export var ToString = TIN_TYPE("ToString", "9f9f8782-9edd-4688-b191-540cb351c4cc", (_p0) => ({toString: _p0}), {
		Type: {
			tag: "Struct",
			name: "ToString",
				fields: [
					{
			Field: {
				name: "toString",
				type: {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "this",
				type: () => Any,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: () => String
		}
	},
				defaultValue: () => { return (undefined);},
			}
		},
		]
		}
	}); ToString._typeId = "ToString";;
export var stringOf/* (obj:Any) -> String*/ = TIN_LAMBDA("07c2548d-1a50-480b-aff5-c6b93bae7b3d", function(obj) {
return ((ToString.__is_child(obj) ) ? (((() => { const _owner = obj; return _owner[ToString._symbol].toString.call(_owner,)})())) : (makeString(obj))) 
}, {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "obj",
				type: () => Any,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: () => String
		}
	});
export var Iterable = /* [] */(T) => TIN_TYPE("Iterable", "d5a09363-cfa8-4106-8c13-f5c92233c983", (_p0,_p1 = TIN_LAMBDA("17a92483-6250-44a2-bfa7-f7b761dcfd67", function(fn) {
var iterator/* Iterator[T]*/ = ((() => { const _owner = this; return _owner[Iterable._symbol].getIterator.call(_owner,)})());
var current/* T?*/ = ((() => { const _owner = iterator; return _owner[Iterator._symbol].next.call(_owner,)})());
while (current != nothing) {
 fn(current);
current = ((() => { const _owner = iterator; return _owner[Iterator._symbol].next.call(_owner,)})()) 
}
}, {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "this",
				type: ???,
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "fn",
				type: {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "undefined",
				type: ???,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: () => Nothing
		}
	},
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: () => Nothing
		}
	}),_p2 = TIN_LAMBDA("28036eb7-d813-4d87-a786-c2cddaa988eb", function(separator, left, right) {
var string/* String*/ = "";
var fn/* (t:T) -> Any*/ = TIN_LAMBDA("8c4dec08-aa8a-4c7f-9eb0-add8ffaaeb0e", function(t) {
var comma/* String*/ = ((string == "") ? ("") : (separator)) ;
return string = "" + string + "" + comma + "" + t + ""
}, {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "t",
				type: () => T,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: ???
		}
	});
((() => { const _owner = this; return _owner[Iterable._symbol].forEach.call(_owner,fn)})());
return "" + left + "" + string + "" + right + ""
}, {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "this",
				type: ???,
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "separator",
				type: () => String,
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "left",
				type: () => String,
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "right",
				type: () => String,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: () => String
		}
	}),_p3 = TIN_LAMBDA("7e9d87d9-7ea6-4eb9-b14c-b443d0863051", function(pred) {
var num/* Number*/ = 0;
((() => { const _owner = this; return _owner[Iterable._symbol].forEach.call(_owner,TIN_LAMBDA("3f75b86d-67c2-4ba0-a827-046db9d44727", function(t) {
return ((pred(t)) ? (num = num + 1) : (null)) 
}, {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "undefined",
				type: () => T,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: ???
		}
	}))})());
return num
}, {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "this",
				type: ???,
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "pred",
				type: {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "undefined",
				type: ???,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: () => Boolean
		}
	},
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: () => Number
		}
	})) => ({getIterator: _p0,forEach: _p1,mkString: _p2,count: _p3}), {
		Type: {
			tag: "Struct",
			name: "Iterable",
				fields: [
					{
			Field: {
				name: "getIterator",
				type: {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [],
			returnType: ???
		}
	},
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "forEach",
				type: {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "this",
				type: ???,
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "fn",
				type: {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "undefined",
				type: ???,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: () => Nothing
		}
	},
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: () => Nothing
		}
	},
				defaultValue: () => { return (TIN_LAMBDA("3b85c26e-9898-4f50-ae83-56460deda32e", function(fn) {
var iterator/* Iterator[T]*/ = ((() => { const _owner = this; return _owner[Iterable._symbol].getIterator.call(_owner,)})());
var current/* T?*/ = ((() => { const _owner = iterator; return _owner[Iterator._symbol].next.call(_owner,)})())
}, {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "this",
				type: ???,
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "fn",
				type: {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "undefined",
				type: ???,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: () => Nothing
		}
	},
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: () => Nothing
		}
	}));},
			}
		},,{
			Field: {
				name: "mkString",
				type: {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "this",
				type: ???,
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "separator",
				type: () => String,
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "left",
				type: () => String,
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "right",
				type: () => String,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: () => String
		}
	},
				defaultValue: () => { return (TIN_LAMBDA("5e0dded9-177a-4471-9a7a-fb223374edd8", function(separator, left, right) {
var string/* String*/ = "";
var fn/* (t:T) -> Any*/ = TIN_LAMBDA("29322445-4d47-4ff8-9ceb-052aa6472782", function(t) {
var comma/* String*/ = ((string == "") ? ("") : (separator)) 
}, {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "t",
				type: () => T,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: ???
		}
	});
return ((() => { const _owner = this; return _owner[Iterable._symbol].forEach.call(_owner,fn)})())
}, {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "this",
				type: ???,
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "separator",
				type: () => String,
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "left",
				type: () => String,
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "right",
				type: () => String,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: () => String
		}
	}));},
			}
		},,{
			Field: {
				name: "count",
				type: {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "this",
				type: ???,
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "pred",
				type: {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "undefined",
				type: ???,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: () => Boolean
		}
	},
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: () => Number
		}
	},
				defaultValue: () => { return (TIN_LAMBDA("64078139-c60c-453e-a684-8eb7a5a19df9", function(pred) {
var num/* Number*/ = 0;
return ((() => { const _owner = this; return _owner[Iterable._symbol].forEach.call(_owner,TIN_LAMBDA("eb59f262-99ff-4c7d-8deb-fe96fc26077e", function(t) {
return undefined
}, {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "undefined",
				type: () => T,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: ???
		}
	}))})())
}, {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "this",
				type: ???,
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "pred",
				type: {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "undefined",
				type: ???,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: () => Boolean
		}
	},
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: () => Number
		}
	}));},
			}
		},
		]
		}
	}); Iterable._typeId = "Iterable";