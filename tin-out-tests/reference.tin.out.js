const __tin_varargs_marker = Symbol();

// Object.prototype._copy = function (...args) {
// 	const keys = Object.keys(this).flatMap(k => Object.keys(this[k]));
// 	let i = 0;
// 	const copyObj = {};
// 	for (let arg of args) {
// 		copyObj[keys[i]] = arg
// 		i++;
// 	}
// 	return { ...this, ...copyObj }
// }

function TIN_TYPE(typeId, typeHash, constructorRaw, descriptor) {
	const constructor = (...args) => {
		const result = constructorRaw(...args)
		return {
			[typeId]: result
		};
	}
	constructor._tinFields = descriptor;
	constructor._typeId = typeId;
	constructor.toString = () => {
		return descriptor.toString()
	}
	constructor.__is_child = (obj) => {
		return (typeof obj === "object") && Reflect.ownKeys(obj).includes(typeId)
	}

	return constructor;
}

function TIN_LAMBDA_TYPE(typeId, paramTypes, returnType) {
	return { __is_child: (f) => typeof f === "function" };
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
			// if (++number > 1) {
			// 	result += " & "
			// }
			// result += componentKey + "("
			for (let key in component) {
				if (component.hasOwnProperty(key)) {
					if (key.startsWith("__")) {
						continue
					}
					result += componentKey + "." + key + "=" + makeString(component[key]) + ', ';
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
export let v/* Number*/ = 1;
export let vv/* Number*/ = 1.1;
export let s/* String*/ = "string, can be spliced like " + v + "";
export let same/* Number*/ = 1;
export let line/* Number*/ = 2;
export let String$anything/* String*/ = "Works";
export let m/* Number*/ = 1;
m = 1;
export let x/* Number*/ = 1 + 2;
export let y/* Number*/ = 12 / 3;
export let number/* Number*/ = 1;
export let string/* String*/ = "str";
export let boolean/* Boolean*/ = false;
export let empty/* Nothing*/ = nothing;
export let any/* Anything*/ = "str";
export let maybeFull/* Number?*/ = 10;
export let maybeEmpty/* Number?*/ = nothing;
export let f/* (n:Number) -> Number*/ = function (n) {
	return n + 1
};
export let ff/* (n:Number) -> Number*/ = function (n) {
	return n + 2
};
print("Hello World");
export let F = TIN_LAMBDA_TYPE("Lambda", [Number], Number);
export let FNamed = TIN_LAMBDA_TYPE("Lambda", [first, second], Number);
f(24);
((v > 0) ? (print("Works")) : (print("Doesn't work")));
export let ifelse/* Number*/ = ((v > 0) ? (1) : (2));
export let i/* Number*/ = 0;
while (i < 3) {
	print(i)
};
export let Cat = TIN_TYPE("Cat", "8b293e5c-5707-473f-917b-f86706c9a114", (_p0, _p1 = 1) => ({ name: _p0, age: _p1 }), {}); Cat._typeId = "Cat";;
export let Mech = TIN_TYPE("Mech", "af08de4b-c330-47d5-ab3c-74e1e18d8ccf", (_p0, _p1) => ({ name: _p0, version: _p1 }), {}); Mech._typeId = "Mech";;
export let test/* Number*/ = 0;
export let kitty/* Cat*/ = Cat("Kitty", 1);
export let mech/* Mech*/ = Mech("Iodized Steel", 3);
kitty.Cat.name;
mech.Mech.version;
export let MechaCat = _TIN_INTERSECT_OBJECTS(Mech, Cat);
export let MechOrCat = _TIN_UNION_OBJECTS(Mech, Cat);
export let mechaCat/* Cat & Mech*/ = _TIN_INTERSECT_OBJECTS(Cat("MechaCat", 10), Mech("Oxidized Copper", 1.4));
mechaCat.Mech.version;
(mechaCat) /* as Cat */.Cat.name == "MechaCat";
(mechaCat) /* as Mech */.Mech.name == "OxidizedCopper";
export let any/* Anything*/ = kitty;
((Cat.__is_child(any)) ? (print(any.Cat.name)) : (null));
export let maybeCat/* Cat?*/ = kitty;
((maybeCat != nothing) ? (print(maybeCat.Cat.age)) : (null));
export let arr/* Array[Number]*/ = Array$of(0)(Array(0)([1, 2, 3, 4]));
((() => { const _owner = arr; return _owner.Array.at.call(_owner, 0) })());
((() => { const _owner = arr; return _owner.Array.length.call(_owner,) })());
export let varargs/* (n:Array[Number]) -> Number*/ = function (n) {
	return ((() => { const _owner = n; return _owner.Array.at.call(_owner, 0) })())
};
varargs(Array(0)([1, 2, 3]));
varargs(Array$of(0)(Array(0)([1, 2])))