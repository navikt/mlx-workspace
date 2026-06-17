fn add<T: std::ops::Add<Output = T>>(a: T, b: T) -> T {
    a + b
}

fn main() {
    // Use the generic function with integers
    println!("{}", add(1, 2)); // Output: 3

    // Use the generic function with strings
    println!("{}", add("Hello, ", "World!")); // Output: Hello, World!
}
