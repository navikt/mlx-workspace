// To install golangci-lint, run the following command:
// go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

package main

import "fmt"

// Define a generic function that takes two parameters of the same type and returns their sum
func add[T int | string](a, b T) T {
    return a + b
}

func main() {
    // Use the generic function with integers
    fmt.Println(add(1, 2)) // Output: 3

    // Use the generic function with strings
    fmt.Println(add("Hello, ", "World!")) // Output: Hello, World!
}
