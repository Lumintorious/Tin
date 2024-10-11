function TIN_TYPE(typeId, constructor, descriptor) {
	constructor._tinFields = descriptor;
	constructor._tinTypeId = typeId;
	constructor["&"] = () => {
		throw new Error("Cannot automatically create intersection type instance. Ambiguous parameter order")
	}
	return constructor
}

const Int = Number

const print = (...args) => console.log(...args);
const Cat  = TIN_TYPE("286e719d-161d-4aa4-96e5-533be11607a7", (_p0,_p1) => ({name: _p0,age: _p1}), {name: { type: String, defaultValue: null },age: { type: Int, defaultValue: 1 }});
const Pokemon  = TIN_TYPE("cfc7f021-71ec-4feb-81b5-4e928209c923", (_p0,_p1) => ({damage: _p0,health: _p1}), {damage: { type: Int, defaultValue: null },health: { type: Int, defaultValue: null }});
const add  = function(undefined, undefined/*[object Object]*/) {
const q /*Int*/ = 1 + 2;
return x + y
};
const myCat  = Cat("Kitty", 12);
((1 < 2) ? (print(32)) : (print(44))) ;
print(myCat . name)