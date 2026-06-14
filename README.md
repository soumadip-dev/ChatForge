# JavaScript Interpreter in Python

A lightweight JavaScript interpreter written entirely in Python. Execute JavaScript code without Node.js or a browser.

## 🔋 Features

### Core JavaScript Support

- **Variables:** `let`, `const`, and `var` declarations
- **Data Types:** numbers, strings, booleans, `null`, `undefined`, arrays, and objects
- **Operators:** arithmetic, comparison, logical, assignment, and increment/decrement operators
- **Control Flow:** `if/else`, `switch/case`, and ternary operators
- **Loops:** `for`, `while`, and `do-while`
- **Functions:** declarations, expressions, closures, and recursion
- **Arrays:** `push`, `pop`, `shift`, `unshift`, `map`, `filter`, `reduce`, `forEach`, `slice`, `splice`, `concat`, `includes`, `indexOf`, `join`, and `reverse`
- **Strings:** `replace`, `substring`, `split`, `trim`, `toUpperCase`, `toLowerCase`, `includes`, `startsWith`, `endsWith`, and `indexOf`
- **Objects:** creation, property access, and iteration using `Object.keys()` and `Object.values()`
- **Math:** support for standard `Math` methods such as `floor`, `ceil`, `pow`, `sqrt`, `abs`, `random`, etc.
- **JSON:** `JSON.stringify()` and `JSON.parse()`

### Built-in Objects

- `console.log()` for output
- `Math` with standard methods
- `Array` with prototype methods
- `Object` with `keys()`, `values()`, and `entries()`
- `JSON` for data serialization
- `Number` with basic methods

## 📋 Requirements

- Python 3.6 or higher
- No external dependencies (uses only the Python standard library)

## 🔧 Installation

```bash
# Clone the repository
git clone https://github.com/soumadip-dev/js-interpreter.git

# Navigate to the project directory
cd js-interpreter

# Make interpreter.py executable (Linux/macOS)
chmod +x interpreter.py
```

## 💻 Usage

### Run a JavaScript File

```bash
python interpreter.py script.js
```

## 📝 Example

```javascript
// test.js
let num = 7;

if (num % 2 === 0) {
  console.log(num + ' is Even');
} else {
  console.log(num + ' is Odd');
}
```

```bash
python interpreter.py test.js

# Output
7 is Odd
```

## 🧪 Test Suite

Run the provided test cases:

```bash
# Basic test cases
python interpreter.py test1.js  # Odd/Even
python interpreter.py test2.js  # Triangle pattern
python interpreter.py test3.js  # Armstrong number
python interpreter.py test4.js  # Array reverse
python interpreter.py test5.js  # Palindrome
```

### Expected Output

| Test       | Description      | Expected Output                                        |
| ---------- | ---------------- | ------------------------------------------------------ |
| `test1.js` | Odd/Even Checker | `7 is Odd`                                             |
| `test2.js` | Triangle Pattern | `*`<br>`**`<br>`***`<br>`****`<br>`*****`              |
| `test3.js` | Armstrong Number | `true`<br>`false`                                      |
| `test4.js` | Array Reverse    | `Original: 1, 2, 3, 4, 5`<br>`Reversed: 5, 4, 3, 2, 1` |
| `test5.js` | Palindrome       | `racecar is a Palindrome`                              |

## 🏗️ Architecture

The interpreter consists of three main components:

1. **Lexer (`tokenize`)** – Converts source code into tokens.
2. **Parser (`parse`)** – Builds an Abstract Syntax Tree (AST).
3. **Evaluator (`Interpreter`)** – Executes the AST with proper scoping.

## 🙏 Acknowledgments

- Inspired by the **"Build Your Own Interpreter"** challenge by Rohit Negi: https://x.com/rohit_negi9
- Thanks to the Coder Army hackathon organizers

## 🎯 Hackathon Submission

This interpreter was built for a hackathon challenge requiring a non-JavaScript program capable of executing JavaScript code. It successfully passes all five required test cases and includes support for many additional JavaScript features.

**Made with Python ❤️ for JavaScript developers**
