package main

import "fmt"

func main() {
	// Declarations
	var v = 1
	// var vv float64 = 1.1
	// var s = "string, can be spliced like " + fmt.Sprint(v)
	// var same = 1
	// var line = 2

	// // Mutation
	// var m = 1
	// // 'set m = 1' is redundant in Go, as you can directly assign to m

	// // Operations
	// var x = 1 + 2
	// var y = 12 / 3

	// // Primitives
	// var number float64 = 1
	// var str string = "str"
	// var boolean bool = false
	// var nothing interface{} = nil // Go doesn't have a built-in "Nothing" type, so we use nil
	// var any interface{} = "str"

	// // Optional (Go doesn't have direct nullable types, so we use pointers or interface{})
	// var maybeFull *float64 = nil
	// var maybeEmpty *float64 = nil

	// Lambdas
	f := func(n float64) float64 {
		return n + 1
	}

	// ff := func(n float64) float64 {
	// 	return n + 2
	// }

	// Lambda Calls
	fmt.Println("Hello World")

	// Named Lambda Calls
	// Go doesn't have direct named lambda calls, but you can use them like this:
	f(24)

	// If
	if v > 0 {
		fmt.Println("Works")
	} else {
		fmt.Println("Doesn't work")
	}

	// var ifelse float64
	// if v > 0 {
	// 	ifelse = 1
	// } else {
	// 	ifelse = 2
	// }

	// While (Go has `for` loops instead of `while`)
	i := 0
	for i < 3 {
		fmt.Println(i)
		i++
	}

	// Data
	type Cat struct {
		Name string
		Age  float64
	}

	type Mech struct {
		Name    string
		Version float64
	}

	// test := 0 // This works, though Go won't support implicit typing like this

	// Constructing
	kitty := Cat{"Kitty", 1}
	mech := Mech{"Iodized Steel", 3.0}

	// Access
	fmt.Println(kitty.Name)
	fmt.Println(mech.Version)

	// Composed types
	// Go doesn't have direct composition with `&`, but you can use embedded types
	type MechaCat struct {
		Cat
		Mech
	}

	mechaCat := MechaCat{Cat: Cat{"MechaCat", 10}, Mech: Mech{"Oxidized Copper", 1.4}}

	// Accessing on composed objects
	fmt.Println(mechaCat.Cat.Name) // This will access the `Name` field from `Cat`
	// mechaCat.Version // This works as well, accessing the `Version` field from `Mech`

	// Type Checks
	var anyVal interface{} = kitty
	if anyVal, ok := anyVal.(Cat); ok {
		fmt.Println(anyVal.Name)
	}

	// Nothing Checks
	var maybeCat *Cat = &kitty
	if maybeCat != nil {
		fmt.Println(maybeCat.Age)
	}

	// Arrays
	arr := []int{1, 2, 3, 4}
	fmt.Println(arr[0])  // Access first element
	fmt.Println(len(arr)) // Length of the array

	// Varargs
	varargs := func(n ...float64) float64 {
		return n[0]
	}

	fmt.Println(varargs(1, 2, 3))
	fmt.Println(varargs(1))
}
