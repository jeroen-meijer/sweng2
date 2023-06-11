pub struct Fun<A, B>(Box<dyn Fn(A) -> B>);

impl<A, B> Fun<A, B> {
    pub fn new<F>(f: F) -> Self
    where
        F: 'static + Fn(A) -> B,
    {
        Fun(Box::new(f))
    }

    pub fn call(self, arg: A) -> B {
        (self.0)(arg)
    }

    pub fn then<C>(self, g: Fun<B, C>) -> Fun<A, C>
    where
        A: 'static,
        B: 'static,
        C: 'static,
    {
        Fun::new(move |x: A| g.call(self.call(x)))
    }
}

fn id<A>() -> Fun<A, A> {
    Fun::new(|x| x)
}

fn main() {
    let f = Fun::new(|x: u64| x * 2);
    let result = f.call(1);
    println!("Result: {}", result); // Output: 2
}
